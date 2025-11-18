import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  created_utc: number;
  score: number;
  num_comments: number;
  url: string;
  permalink: string;
}

interface RedditComment {
  id: string;
  body: string;
  author: string;
  created_utc: number;
  score: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subreddit, postId, limit = 25 } = await req.json();
    
    console.log(`Starting Reddit scrape: subreddit=${subreddit}, postId=${postId}, limit=${limit}`);

    if (!subreddit) {
      return new Response(
        JSON.stringify({ error: 'Subreddit parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let posts: RedditPost[] = [];
    let comments: RedditComment[] = [];
    let redditUrl: string;

    // Determine what to scrape
    if (postId) {
      // Scrape specific post and its comments
      redditUrl = `https://www.reddit.com/r/${subreddit}/comments/${postId}.json`;
      console.log(`Fetching specific post: ${redditUrl}`);
      
      const response = await fetch(redditUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // First array element contains the post
      if (data[0]?.data?.children?.[0]) {
        const postData = data[0].data.children[0].data;
        posts.push({
          id: postData.id,
          title: postData.title,
          selftext: postData.selftext || '',
          author: postData.author,
          created_utc: postData.created_utc,
          score: postData.score,
          num_comments: postData.num_comments,
          url: postData.url,
          permalink: postData.permalink
        });
      }

      // Second array element contains comments
      if (data[1]?.data?.children) {
        comments = extractComments(data[1].data.children);
      }
    } else {
      // Scrape subreddit listing
      redditUrl = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;
      console.log(`Fetching subreddit listing: ${redditUrl}`);
      
      const response = await fetch(redditUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data?.data?.children) {
        posts = data.data.children
          .filter((child: any) => child.kind === 't3')
          .map((child: any) => {
            const postData = child.data;
            return {
              id: postData.id,
              title: postData.title,
              selftext: postData.selftext || '',
              author: postData.author,
              created_utc: postData.created_utc,
              score: postData.score,
              num_comments: postData.num_comments,
              url: postData.url,
              permalink: postData.permalink
            };
          });
      }
    }

    console.log(`Scraped ${posts.length} posts and ${comments.length} comments`);

    // Store in database
    const { data: dataSource, error: insertError } = await supabase
      .from('data_sources')
      .insert({
        user_id: user.id,
        name: postId ? `Reddit Post: ${posts[0]?.title || postId}` : `r/${subreddit}`,
        source_type: 'reddit',
        url: redditUrl,
        content: {
          subreddit,
          posts,
          comments,
          scraped_at: new Date().toISOString()
        },
        item_count: posts.length + comments.length
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw insertError;
    }

    console.log(`Successfully stored data source: ${dataSource.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        dataSourceId: dataSource.id,
        postsScraped: posts.length,
        commentsScraped: comments.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in scrape-reddit function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Recursively extract comments from Reddit's nested structure
function extractComments(children: any[]): RedditComment[] {
  const comments: RedditComment[] = [];
  
  for (const child of children) {
    if (child.kind === 't1' && child.data) {
      const commentData = child.data;
      
      // Skip deleted/removed comments
      if (commentData.body && 
          commentData.body !== '[deleted]' && 
          commentData.body !== '[removed]') {
        comments.push({
          id: commentData.id,
          body: commentData.body,
          author: commentData.author,
          created_utc: commentData.created_utc,
          score: commentData.score
        });
      }

      // Recursively get replies
      if (commentData.replies?.data?.children) {
        comments.push(...extractComments(commentData.replies.data.children));
      }
    }
  }
  
  return comments;
}
