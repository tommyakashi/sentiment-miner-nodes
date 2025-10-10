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

function convertPostToRedditData(post: RedditPost): any {
  return {
    id: post.data.id,
    parsedId: post.data.id,
    url: `https://reddit.com${post.data.permalink}`,
    username: post.data.author,
    userId: post.data.author,
    title: post.data.title,
    communityName: post.data.subreddit,
    parsedCommunityName: post.data.subreddit,
    body: post.data.selftext || '',
    html: '',
    link: `https://reddit.com${post.data.permalink}`,
    numberOfComments: post.data.num_comments,
    upVotes: post.data.score,
    upVoteRatio: 1,
    isVideo: false,
    isAd: false,
    over18: false,
    thumbnailUrl: '',
    createdAt: new Date(post.data.created_utc * 1000).toISOString(),
    scrapedAt: new Date().toISOString(),
    dataType: 'post'
  };
}

function convertCommentToRedditData(comment: RedditComment, postId: string = ''): any {
  return {
    id: comment.data.id,
    parsedId: comment.data.id,
    url: `https://reddit.com/comments/${postId}/_/${comment.data.id}`,
    postId: postId,
    parentId: '',
    username: comment.data.author,
    userId: comment.data.author,
    category: '',
    communityName: '',
    body: comment.data.body,
    createdAt: new Date(comment.data.created_utc * 1000).toISOString(),
    scrapedAt: new Date().toISOString(),
    upVotes: comment.data.score,
    numberOfreplies: 0,
    html: '',
    dataType: 'comment'
  };
}

function extractCommentsFromTree(comments: any[], postId: string, maxDepth: number = 10): any[] {
  const results: any[] = [];
  
  function traverse(comment: any, depth: number = 0) {
    if (!comment || depth > maxDepth) return;
    
    if (comment.kind === 't1' && comment.data?.body) {
      const body = comment.data.body;
      if (body.length > 20 && !body.startsWith('[deleted]') && !body.startsWith('[removed]')) {
        const converted = convertCommentToRedditData(comment as RedditComment, postId);
        if (converted) results.push(converted);
      }
    }
    
    // Recursively traverse replies
    if (comment.data?.replies?.data?.children) {
      for (const reply of comment.data.replies.data.children) {
        if (reply && typeof reply === 'object') {
          traverse(reply, depth + 1);
        }
      }
    }
  }
  
  for (const comment of comments) {
    if (comment && typeof comment === 'object') {
      traverse(comment);
    }
  }
  
  return results.filter(item => item && item.dataType);
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

    let redditData: any[] = [];

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
          const postData = convertPostToRedditData(postListing.data.children[0]);
          redditData.push(postData);
        }
        
        // Extract comments
        const commentsListing = data[1];
        if (commentsListing.data?.children) {
          const postId = postListing.data?.children?.[0]?.data?.id || '';
          const comments = extractCommentsFromTree(commentsListing.data.children, postId);
          redditData.push(...comments);
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
            const postData = convertPostToRedditData(child);
            redditData.push(postData);
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
            const postData = convertPostToRedditData(child);
            redditData.push(postData);
          }
        }
      }
    } else {
      throw new Error('Unsupported Reddit URL format. Please provide a post URL, subreddit URL, or user URL.');
    }

    console.log(`Extracted ${redditData.length} items from Reddit API`);

    // Filter out any undefined/null items
    redditData = redditData.filter(item => item && typeof item === 'object' && item.dataType);

    if (redditData.length === 0) {
      throw new Error('No content found. The URL might be invalid or have no accessible content.');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        data: redditData,
        itemCount: redditData.length,
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
