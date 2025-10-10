import type { RedditPost, RedditComment, RedditData } from '@/types/reddit';

const BOT_PATTERNS = [
  /^i am a bot/i,
  /^i'm a bot/i,
  /this action was performed automatically/i,
  /contact the moderators/i,
  /^automod/i,
  /^\[removed\]$/i,
  /^\[deleted\]$/i,
];

const URL_PATTERN = /https?:\/\/[^\s]+/g;
const REDDIT_LINK_PATTERN = /\/r\/\w+|\/u\/\w+|u\/\w+|r\/\w+/g;

export function isBot(text: string, username?: string): boolean {
  if (username) {
    const lowerUsername = username.toLowerCase();
    if (lowerUsername.includes('bot') || lowerUsername.includes('automod')) {
      return true;
    }
  }

  return BOT_PATTERNS.some(pattern => pattern.test(text));
}

export function cleanText(text: string): string {
  if (!text || text.trim() === '') return '';

  // Remove URLs
  let cleaned = text.replace(URL_PATTERN, '[LINK]');
  
  // Remove Reddit links
  cleaned = cleaned.replace(REDDIT_LINK_PATTERN, '');
  
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Remove markdown artifacts but preserve emphasis markers
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // [text](url) -> text
  
  return cleaned;
}

export function extractTextWithContext(data: RedditData, posts: RedditPost[]): string {
  if (data.dataType === 'post') {
    const post = data as RedditPost;
    // Combine title and body for full context
    const title = post.title || '';
    const body = post.body || '';
    return cleanText(`${title}. ${body}`);
  } else {
    const comment = data as RedditComment;
    
    // Find the parent post for context
    const parentPost = posts.find(p => p.id === comment.postId);
    const postContext = parentPost?.title || '';
    
    // Combine post context with comment
    const commentText = comment.body || '';
    
    // If comment is short, add post context
    if (commentText.length < 100 && postContext) {
      return cleanText(`Context: ${postContext}. Comment: ${commentText}`);
    }
    
    return cleanText(commentText);
  }
}

export function shouldIncludeText(text: string, username?: string): boolean {
  // Filter out bots
  if (isBot(text, username)) {
    return false;
  }

  // Filter out very short texts (likely not meaningful)
  if (text.length < 10) {
    return false;
  }

  // Filter out texts that are mostly links or deleted content
  if (text.includes('[LINK]') && text.replace(/\[LINK\]/g, '').trim().length < 10) {
    return false;
  }

  if (text === '[removed]' || text === '[deleted]') {
    return false;
  }

  return true;
}

export interface EnhancedText {
  text: string;
  originalIndex: number;
  username: string;
  timestamp: string;
  upvotes: number;
  isPost: boolean;
  postTitle?: string;
}

export function extractRedditTexts(
  data: RedditData[], 
  posts: RedditPost[]
): EnhancedText[] {
  const enhancedTexts: EnhancedText[] = [];

  data.forEach((item, index) => {
    const rawText = extractTextWithContext(item, posts);
    const username = item.username;
    
    if (!shouldIncludeText(rawText, username)) {
      return;
    }

    const enhanced: EnhancedText = {
      text: rawText,
      originalIndex: index,
      username: username,
      timestamp: item.createdAt,
      upvotes: item.upVotes,
      isPost: item.dataType === 'post',
    };

    if (item.dataType === 'comment') {
      const parentPost = posts.find(p => p.id === (item as RedditComment).postId);
      if (parentPost) {
        enhanced.postTitle = parentPost.title;
      }
    }

    enhancedTexts.push(enhanced);
  });

  return enhancedTexts;
}
