import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    author: string;
    created_utc: number;
    score: number;
    num_comments: number;
    subreddit: string;
    permalink: string;
  };
}

interface RedditComment {
  data: {
    id: string;
    body: string;
    author: string;
    created_utc: number;
    score: number;
  };
}

async function getRedditAccessToken(): Promise<string> {
  const clientId = Deno.env.get('REDDIT_CLIENT_ID');
  const clientSecret = Deno.env.get('REDDIT_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Reddit API credentials not configured');
  }

  const auth = btoa(`${clientId}:${clientSecret}`);
  
  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Laude/1.0',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Token error:', error);
    throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
  }

  const data: RedditTokenResponse = await response.json();
  console.log('Successfully obtained Reddit access token');
  return data.access_token;
}

async function fetchWithAuth(url: string, token: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Laude/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

function extractTextsFromPost(post: RedditPost): string[] {
  const texts: string[] = [];
  
  if (post.data.title) {
    texts.push(post.data.title);
  }
  
  if (post.data.selftext && post.data.selftext.length > 20) {
    texts.push(post.data.selftext);
  }
  
  return texts;
}

function extractTextsFromComments(comments: any[], maxDepth: number = 10): string[] {
  const texts: string[] = [];
  
  function traverse(comment: any, depth: number = 0) {
    if (depth > maxDepth) return;
    
    if (comment.kind === 't1' && comment.data?.body) {
      const body = comment.data.body;
      if (body.length > 20 && !body.startsWith('[deleted]') && !body.startsWith('[removed]')) {
        texts.push(body);
      }
    }
    
    // Recursively traverse replies
    if (comment.data?.replies?.data?.children) {
      for (const reply of comment.data.replies.data.children) {
        traverse(reply, depth + 1);
      }
    }
  }
  
  for (const comment of comments) {
    traverse(comment);
  }
  
  return texts;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      throw new Error("URL is required");
    }

    console.log(`Scraping Reddit URL via API: ${url}`);

    // Get OAuth token
    const token = await getRedditAccessToken();

    let texts: string[] = [];

    // Parse URL to determine if it's a post or subreddit listing
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p);

    if (pathParts.includes('comments') && pathParts.length >= 5) {
      // Single post with comments: /r/{subreddit}/comments/{post_id}/{title}
      const subreddit = pathParts[1];
      const postId = pathParts[3];
      
      console.log(`Fetching post ${postId} from r/${subreddit} with comments`);
      
      // Fetch post and comments
      const apiUrl = `https://oauth.reddit.com/r/${subreddit}/comments/${postId}?limit=500&depth=10`;
      const data = await fetchWithAuth(apiUrl, token);
      
      // Reddit returns [post_listing, comments_listing]
      if (Array.isArray(data) && data.length >= 2) {
        // Extract post
        const postListing = data[0];
        if (postListing.data?.children?.[0]) {
          const postTexts = extractTextsFromPost(postListing.data.children[0]);
          texts.push(...postTexts);
        }
        
        // Extract comments
        const commentsListing = data[1];
        if (commentsListing.data?.children) {
          const commentTexts = extractTextsFromComments(commentsListing.data.children);
          texts.push(...commentTexts);
        }
      }
    } else if (pathParts[0] === 'r' && pathParts.length >= 2) {
      // Subreddit listing: /r/{subreddit}
      const subreddit = pathParts[1];
      const limit = 100; // Max posts to fetch
      
      console.log(`Fetching posts from r/${subreddit}`);
      
      const apiUrl = `https://oauth.reddit.com/r/${subreddit}/hot?limit=${limit}`;
      const data = await fetchWithAuth(apiUrl, token);
      
      if (data.data?.children) {
        for (const child of data.data.children) {
          if (child.kind === 't3') {
            const postTexts = extractTextsFromPost(child);
            texts.push(...postTexts);
          }
        }
      }
    } else if (pathParts[0] === 'user' && pathParts.length >= 2) {
      // User posts: /user/{username} or /u/{username}
      const username = pathParts[1];
      const limit = 100;
      
      console.log(`Fetching posts from u/${username}`);
      
      const apiUrl = `https://oauth.reddit.com/user/${username}/submitted?limit=${limit}`;
      const data = await fetchWithAuth(apiUrl, token);
      
      if (data.data?.children) {
        for (const child of data.data.children) {
          if (child.kind === 't3') {
            const postTexts = extractTextsFromPost(child);
            texts.push(...postTexts);
          }
        }
      }
    } else {
      throw new Error('Unsupported Reddit URL format. Please provide a post URL, subreddit URL, or user URL.');
    }

    // Remove duplicates and empty texts
    texts = [...new Set(texts)].filter(text => text.trim().length > 0);

    console.log(`Extracted ${texts.length} items from Reddit API`);

    if (texts.length === 0) {
      throw new Error('No content found. The URL might be invalid or have no accessible content.');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        texts,
        itemCount: texts.length,
        source: 'reddit'
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error scraping Reddit:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
