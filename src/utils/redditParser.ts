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

export function extractTimeSeriesData(data: RedditData[]) {
  const timeSeriesMap = new Map<string, { positive: number; negative: number; neutral: number; volume: number }>();

  data.forEach(item => {
    const date = new Date(item.createdAt).toISOString().split('T')[0];
    
    if (!timeSeriesMap.has(date)) {
      timeSeriesMap.set(date, { positive: 0, negative: 0, neutral: 0, volume: 0 });
    }

    const entry = timeSeriesMap.get(date)!;
    entry.volume++;

    // Simple heuristic: high upvotes = positive, low/negative = negative
    const upvotes = item.upVotes || 0;
    if (upvotes > 5) {
      entry.positive++;
    } else if (upvotes < -2) {
      entry.negative++;
    } else {
      entry.neutral++;
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
