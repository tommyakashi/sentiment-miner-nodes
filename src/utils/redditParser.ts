import type { RedditData, RedditPost, RedditComment, ParsedRedditData } from '@/types/reddit';
import { extractRedditTexts } from './sentiment/utils/textPreprocessor';

export function parseRedditJSON(jsonData: RedditData[]): ParsedRedditData {
  const posts: RedditPost[] = [];
  const comments: RedditComment[] = [];

  // Separate posts and comments
  jsonData.forEach(item => {
    if (item.dataType === 'post') {
      posts.push(item as RedditPost);
    } else {
      comments.push(item as RedditComment);
    }
  });

  // Extract enhanced texts with context
  const enhancedTexts = extractRedditTexts(jsonData, posts);
  const allText = enhancedTexts.map(et => et.text);

  // Aggregate participant data
  const participants = new Map<string, { username: string; count: number; totalUpvotes: number }>();
  
  jsonData.forEach(item => {
    const username = item.username;
    if (!username || username === '[deleted]') return;

    if (!participants.has(username)) {
      participants.set(username, {
        username,
        count: 0,
        totalUpvotes: 0,
      });
    }

    const participant = participants.get(username)!;
    participant.count++;
    participant.totalUpvotes += item.upVotes || 0;
  });

  console.log(`Parsed Reddit data: ${posts.length} posts, ${comments.length} comments, ${allText.length} valid texts`);

  return {
    posts,
    comments,
    allText,
    participants,
  };
}

export function extractTimeSeriesData(data: RedditData[], sentimentResults?: Array<{ text: string; polarityScore: number }>) {
  const timeSeriesMap = new Map<string, { positive: number; negative: number; neutral: number; volume: number }>();

  data.forEach(item => {
    try {
      const date = new Date(item.createdAt);
      
      // Validate date
      if (isNaN(date.getTime())) {
        console.warn('Invalid date in Reddit data:', item.createdAt);
        return;
      }
      
      const dateStr = date.toISOString().split('T')[0];
      
      if (!timeSeriesMap.has(dateStr)) {
        timeSeriesMap.set(dateStr, { positive: 0, negative: 0, neutral: 0, volume: 0 });
      }

      const entry = timeSeriesMap.get(dateStr)!;
      entry.volume++;

      // Use actual sentiment if available, otherwise fall back to upvotes
      if (sentimentResults) {
        // Build text from Reddit item
        const itemText = item.dataType === 'post' 
          ? `${(item as any).title || ''} ${item.body || ''}`.trim()
          : item.body || '';
        
        // Find matching sentiment result
        const sentimentMatch = sentimentResults.find(sr => {
          // Match by checking if the text contains significant portion of the item text
          const normalizedItemText = itemText.toLowerCase().slice(0, 100);
          const normalizedSentimentText = sr.text.toLowerCase().slice(0, 100);
          return normalizedSentimentText.includes(normalizedItemText) || 
                 normalizedItemText.includes(normalizedSentimentText);
        });
        
        if (sentimentMatch) {
          // Use actual sentiment polarity
          if (sentimentMatch.polarityScore > 0.15) {
            entry.positive++;
          } else if (sentimentMatch.polarityScore < -0.15) {
            entry.negative++;
          } else {
            entry.neutral++;
          }
        } else {
          // Fallback to upvote heuristic if no sentiment match
          const upvotes = item.upVotes || 0;
          if (upvotes > 5) {
            entry.positive++;
          } else if (upvotes < -2) {
            entry.negative++;
          } else {
            entry.neutral++;
          }
        }
      } else {
        // Original upvote-based heuristic (fallback when no sentiment results)
        const upvotes = item.upVotes || 0;
        if (upvotes > 5) {
          entry.positive++;
        } else if (upvotes < -2) {
          entry.negative++;
        } else {
          entry.neutral++;
        }
      }
    } catch (err) {
      console.error('Error processing date for item:', err);
    }
  });

  // Convert to array and calculate sentiment scores
  return Array.from(timeSeriesMap.entries())
    .map(([date, counts]) => ({
      date,
      sentiment: (counts.positive - counts.negative) / counts.volume,
      volume: counts.volume,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
