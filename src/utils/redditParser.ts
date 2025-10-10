import type { RedditData, RedditPost, RedditComment, ParsedRedditData } from '@/types/reddit';

export function parseRedditJSON(jsonData: RedditData[]): ParsedRedditData {
  const posts: RedditPost[] = [];
  const comments: RedditComment[] = [];
  const allText: string[] = [];
  const participants = new Map<string, { username: string; count: number; totalUpvotes: number }>();

  jsonData.forEach(item => {
    if (item.dataType === 'post') {
      posts.push(item as RedditPost);
      if (item.body && item.body.length > 20) {
        allText.push(item.body);
      }
      if (item.title) {
        allText.push(item.title);
      }
    } else if (item.dataType === 'comment') {
      const comment = item as RedditComment;
      comments.push(comment);
      if (comment.body && comment.body.length > 20) {
        allText.push(comment.body);
      }

      // Track participants
      const existing = participants.get(comment.username) || {
        username: comment.username,
        count: 0,
        totalUpvotes: 0,
      };
      participants.set(comment.username, {
        username: comment.username,
        count: existing.count + 1,
        totalUpvotes: existing.totalUpvotes + (comment.upVotes || 0),
      });
    }
  });

  return { posts, comments, allText, participants };
}

export function extractTimeSeriesData(data: RedditData[]) {
  const timeMap = new Map<string, { positive: number; negative: number; neutral: number; total: number }>();

  data.forEach(item => {
    // Handle both ISO strings and invalid dates
    let date: string;
    try {
      const dateObj = new Date(item.createdAt);
      if (isNaN(dateObj.getTime())) {
        // Invalid date, use current date
        date = new Date().toISOString().split('T')[0];
      } else {
        date = dateObj.toISOString().split('T')[0];
      }
    } catch {
      date = new Date().toISOString().split('T')[0];
    }
    const existing = timeMap.get(date) || { positive: 0, negative: 0, neutral: 0, total: 0 };
    
    // Simple sentiment heuristic based on upvotes
    const upvotes = item.upVotes || 0;
    if (upvotes > 5) {
      existing.positive += 1;
    } else if (upvotes < 0) {
      existing.negative += 1;
    } else {
      existing.neutral += 1;
    }
    existing.total += 1;

    timeMap.set(date, existing);
  });

  return Array.from(timeMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data]) => ({
      date,
      sentiment: ((data.positive - data.negative) / data.total) * 100,
      volume: data.total,
    }));
}
