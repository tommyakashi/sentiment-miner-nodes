import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Core high-activity subreddits for fast mode (15 subreddits)
const FAST_MODE_SUBREDDITS = [
  'AskAcademia', 'GradSchool', 'PhD', 'science', 'MachineLearning',
  'datascience', 'LocalLLaMA', 'cscareerquestions', 'labrats', 'Professors',
  'singularity', 'AGI', 'artificial', 'deeplearning', 'compsci'
];

// Full subreddits for comprehensive analysis
const DEFAULT_SUBREDDITS = [
  'AskAcademia', 'GradSchool', 'PhD', 'science', 'AcademicPsychology',
  'labrats', 'Professors', 'scholarships', 'researchstudents', 'PostDoc',
  'OpenScience', 'MachineLearning', 'datascience', 'SciencePolicy', 'engineering',
  'AskScienceDiscussion', 'academia', 'ScientificComputing', 'artificial', 'deeplearning',
  'LanguageTechnology', 'computervision', 'reinforcementlearning', 'learnmachinelearning',
  'MLQuestions', 'LocalLLaMA', 'cscareerquestions', 'compsci', 'algorithms',
  'MachineLearningResearch', 'robotics', 'QuantumComputing', 'computerscience',
  'MLPapers', 'ControlProblem', 'AIethics', 'singularity', 'AGI', 'HCI'
];

type TimeRange = 'day' | 'week' | 'month' | '3days';
type SortMode = 'top' | 'hot' | 'rising';

interface RedditPost {
  id: string;
  parsedId: string;
  url: string;
  username: string;
  userId: string;
  title: string;
  communityName: string;
  parsedCommunityName: string;
  body: string;
  html: string;
  link: string;
  numberOfComments: number;
  flair: string;
  upVotes: number;
  upVoteRatio: number;
  isVideo: boolean;
  isAd: boolean;
  over18: boolean;
  thumbnailUrl: string;
  createdAt: string;
  scrapedAt: string;
  dataType: 'post';
}

interface RedditComment {
  id: string;
  parsedId: string;
  url: string;
  postId: string;
  parentId: string;
  username: string;
  userId: string;
  category: string;
  communityName: string;
  body: string;
  createdAt: string;
  scrapedAt: string;
  upVotes: number;
  numberOfreplies: number;
  html: string;
  dataType: 'comment';
}

// Track execution start time for timeout protection
const EXECUTION_START = Date.now();
const MAX_EXECUTION_TIME = 50000; // 50 seconds (leave buffer for response)

function isNearTimeout(): boolean {
  return Date.now() - EXECUTION_START > MAX_EXECUTION_TIME;
}

function getTimestampForRange(timeRange: TimeRange): number {
  const now = Math.floor(Date.now() / 1000);
  switch (timeRange) {
    case 'day':
      return now - (24 * 60 * 60);
    case '3days':
      return now - (3 * 24 * 60 * 60);
    case 'week':
      return now - (7 * 24 * 60 * 60);
    case 'month':
      return now - (30 * 24 * 60 * 60);
    default:
      return now - (24 * 60 * 60);
  }
}

// Map our time range to Reddit's time parameter
function getRedditTimeParam(timeRange: TimeRange): string {
  switch (timeRange) {
    case 'day':
      return 'day';
    case '3days':
      return 'week'; // Reddit doesn't have 3 days, use week
    case 'week':
      return 'week';
    case 'month':
      return 'month';
    default:
      return 'day';
  }
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// Cache for Reddit OAuth token
let cachedToken: { token: string; expiresAt: number } | null = null;

// Get Reddit OAuth access token using client credentials
async function getRedditAccessToken(): Promise<string | null> {
  // Check if we have a valid cached token
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = Deno.env.get('REDDIT_CLIENT_ID');
  const clientSecret = Deno.env.get('REDDIT_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    console.log('[OAuth] Missing REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET');
    return null;
  }

  try {
    const auth = btoa(`${clientId}:${clientSecret}`);
    
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'ResearchSentimentTracker/1.0 (by /u/research_tracker)'
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      console.log(`[OAuth] Token request failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.access_token) {
      // Cache token with 5 minute buffer before expiry
      cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + ((data.expires_in - 300) * 1000)
      };
      console.log('[OAuth] Token obtained successfully');
      return data.access_token;
    }

    return null;
  } catch (error) {
    console.log(`[OAuth] Error getting token: ${error}`);
    return null;
  }
}

// PRIMARY: Reddit OAuth API - has full engagement data and proper sorting
async function scrapeViaRedditOAuth(
  subreddit: string,
  timeRange: TimeRange,
  sortMode: SortMode,
  limit: number = 25
): Promise<{ posts: RedditPost[]; comments: RedditComment[]; method: string }> {
  const posts: RedditPost[] = [];
  const comments: RedditComment[] = [];
  const scrapedAt = new Date().toISOString();
  const redditTime = getRedditTimeParam(timeRange);

  const accessToken = await getRedditAccessToken();
  
  if (!accessToken) {
    console.log(`[OAuth] No token available for r/${subreddit}`);
    return { posts, comments, method: 'oauth_no_token' };
  }

  try {
    // Build URL based on sort mode
    // For 'top', we need the time parameter. For 'hot' and 'rising', no time param needed
    let url = `https://oauth.reddit.com/r/${subreddit}/${sortMode}?limit=${limit}&raw_json=1`;
    if (sortMode === 'top') {
      url += `&t=${redditTime}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'ResearchSentimentTracker/1.0 (by /u/research_tracker)'
      }
    });

    if (!response.ok) {
      console.log(`[OAuth] Failed r/${subreddit}: ${response.status}`);
      return { posts, comments, method: 'oauth_failed' };
    }

    const data = await response.json();
    const children = data?.data?.children || [];

    for (const child of children) {
      if (child.kind !== 't3') continue;
      const p = child.data;
      
      if (p.author === '[deleted]' || p.removed_by_category) continue;

      posts.push({
        id: p.id,
        parsedId: `t3_${p.id}`,
        url: `https://www.reddit.com${p.permalink}`,
        username: p.author || '[unknown]',
        userId: p.author_fullname || '',
        title: p.title || '',
        communityName: `r/${subreddit}`,
        parsedCommunityName: subreddit,
        body: p.selftext || '',
        html: '',
        link: p.url || '',
        numberOfComments: p.num_comments || 0,
        flair: p.link_flair_text || '',
        upVotes: p.score || 0,
        upVoteRatio: p.upvote_ratio || 0,
        isVideo: p.is_video || false,
        isAd: false,
        over18: p.over_18 || false,
        thumbnailUrl: p.thumbnail || '',
        createdAt: new Date((p.created_utc || p.created) * 1000).toISOString(),
        scrapedAt,
        dataType: 'post'
      });
    }

    // Fetch comments for top 3 posts that have comments
    const postsWithComments = posts.filter(p => p.numberOfComments > 0).slice(0, 3);
    
    for (const post of postsWithComments) {
      try {
        const commentsUrl = `https://oauth.reddit.com/r/${subreddit}/comments/${post.id}?limit=10&depth=1&raw_json=1`;
        
        const commentsResponse = await fetch(commentsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': 'ResearchSentimentTracker/1.0 (by /u/research_tracker)'
          }
        });

        if (commentsResponse.ok) {
          const commentsData = await commentsResponse.json();
          
          if (Array.isArray(commentsData) && commentsData.length >= 2) {
            const commentsListing = commentsData[1]?.data?.children || [];
            
            for (const item of commentsListing) {
              if (item.kind !== 't1') continue;
              const c = item.data;
              
              if (!c.body || c.body === '[deleted]' || c.body === '[removed]' || c.author === '[deleted]') continue;
              
              comments.push({
                id: c.id,
                parsedId: `t1_${c.id}`,
                url: `https://www.reddit.com${c.permalink || ''}`,
                postId: `t3_${post.id}`,
                parentId: c.parent_id || '',
                username: c.author || '[unknown]',
                userId: c.author_fullname || '',
                category: '',
                communityName: `r/${subreddit}`,
                body: c.body,
                createdAt: new Date((c.created_utc || c.created || Date.now() / 1000) * 1000).toISOString(),
                scrapedAt,
                upVotes: c.score || 0,
                numberOfreplies: c.replies?.data?.children?.length || 0,
                html: '',
                dataType: 'comment'
              });
            }
          }
        }
        
        // Small delay between comment fetches
        await new Promise(r => setTimeout(r, 100));
      } catch {
        // Continue without comments for this post
      }
    }

    if (posts.length > 0) {
      const avgUpvotes = Math.round(posts.reduce((a, p) => a + p.upVotes, 0) / posts.length);
      console.log(`[OAuth] r/${subreddit} (${sortMode}): ${posts.length} posts (avg ${avgUpvotes} upvotes), ${comments.length} comments`);
    }

    return { posts, comments, method: 'oauth' };

  } catch (error) {
    console.log(`[OAuth] Error r/${subreddit}: ${error}`);
    return { posts, comments, method: 'oauth_error' };
  }
}

// FALLBACK 1: Public Reddit JSON (may get rate limited)
async function scrapeViaRedditJSON(
  subreddit: string,
  timeRange: TimeRange,
  sortMode: SortMode,
  limit: number = 25
): Promise<{ posts: RedditPost[]; comments: RedditComment[]; method: string }> {
  const posts: RedditPost[] = [];
  const comments: RedditComment[] = [];
  const scrapedAt = new Date().toISOString();
  const redditTime = getRedditTimeParam(timeRange);

  try {
    // Build URL based on sort mode
    let url = `https://www.reddit.com/r/${subreddit}/${sortMode}.json?limit=${limit}&raw_json=1`;
    if (sortMode === 'top') {
      url += `&t=${redditTime}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) {
      console.log(`[JSON] Failed r/${subreddit}: ${response.status}`);
      return { posts, comments, method: 'json_failed' };
    }

    const data = await response.json();
    const children = data?.data?.children || [];

    for (const child of children) {
      if (child.kind !== 't3') continue;
      const p = child.data;
      
      if (p.author === '[deleted]' || p.removed_by_category) continue;

      posts.push({
        id: p.id,
        parsedId: `t3_${p.id}`,
        url: `https://www.reddit.com${p.permalink}`,
        username: p.author || '[unknown]',
        userId: p.author_fullname || '',
        title: p.title || '',
        communityName: `r/${subreddit}`,
        parsedCommunityName: subreddit,
        body: p.selftext || '',
        html: '',
        link: p.url || '',
        numberOfComments: p.num_comments || 0,
        flair: p.link_flair_text || '',
        upVotes: p.score || 0,
        upVoteRatio: p.upvote_ratio || 0,
        isVideo: p.is_video || false,
        isAd: false,
        over18: p.over_18 || false,
        thumbnailUrl: p.thumbnail || '',
        createdAt: new Date((p.created_utc || p.created) * 1000).toISOString(),
        scrapedAt,
        dataType: 'post'
      });
    }

    if (posts.length > 0) {
      const avgUpvotes = Math.round(posts.reduce((a, p) => a + p.upVotes, 0) / posts.length);
      console.log(`[JSON] r/${subreddit} (${sortMode}): ${posts.length} posts (avg ${avgUpvotes} upvotes)`);
    }

    return { posts, comments, method: 'json' };

  } catch (error) {
    console.log(`[JSON] Error r/${subreddit}: ${error}`);
    return { posts, comments, method: 'json_error' };
  }
}

// Parse RSS XML to extract posts
function parseRSSXML(xmlText: string, subreddit: string, scrapedAt: string): RedditPost[] {
  const posts: RedditPost[] = [];
  const entryMatches = xmlText.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  
  for (const entry of entryMatches) {
    try {
      const idMatch = entry.match(/<id>([^<]+)<\/id>/);
      const id = idMatch ? idMatch[1].split('/').pop() || '' : '';
      
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
      const title = titleMatch ? decodeHTMLEntities(titleMatch[1]) : '';
      
      const linkMatch = entry.match(/<link href="([^"]+)"/);
      const url = linkMatch ? linkMatch[1] : '';
      
      const authorMatch = entry.match(/<author><name>\/u\/([^<]+)<\/name><\/author>/);
      const username = authorMatch ? authorMatch[1] : '[unknown]';
      
      const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
      const createdAt = publishedMatch ? publishedMatch[1] : new Date().toISOString();
      
      const contentMatch = entry.match(/<content type="html">([^]*?)<\/content>/);
      let body = '';
      if (contentMatch) {
        body = decodeHTMLEntities(contentMatch[1])
          .replace(/<[^>]*>/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      if (id && title) {
        posts.push({
          id: id.replace('t3_', ''),
          parsedId: id.startsWith('t3_') ? id : `t3_${id}`,
          url,
          username,
          userId: '',
          title,
          communityName: `r/${subreddit}`,
          parsedCommunityName: subreddit,
          body,
          html: '',
          link: url,
          numberOfComments: 0, // RSS doesn't have this
          flair: '',
          upVotes: 0, // RSS doesn't have this
          upVoteRatio: 0,
          isVideo: false,
          isAd: false,
          over18: false,
          thumbnailUrl: '',
          createdAt,
          scrapedAt,
          dataType: 'post'
        });
      }
    } catch {
      // Skip malformed entries
    }
  }
  
  return posts;
}

// FALLBACK 2: RSS scrape - uses sort mode with time parameter
async function scrapeViaRSS(
  subreddit: string, 
  timeRange: TimeRange,
  sortMode: SortMode
): Promise<{ posts: RedditPost[]; comments: RedditComment[]; method: string }> {
  const posts: RedditPost[] = [];
  const comments: RedditComment[] = [];
  const scrapedAt = new Date().toISOString();
  const redditTime = getRedditTimeParam(timeRange);

  try {
    // Build RSS URL based on sort mode
    let rssUrl = `https://www.reddit.com/r/${subreddit}/${sortMode}/.rss?limit=25`;
    if (sortMode === 'top') {
      rssUrl += `&t=${redditTime}`;
    }
    
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    });

    if (!response.ok) {
      console.log(`[RSS] Failed r/${subreddit}: ${response.status}`);
      return { posts, comments, method: 'rss_failed' };
    }

    const xmlText = await response.text();
    const parsedPosts = parseRSSXML(xmlText, subreddit, scrapedAt);
    posts.push(...parsedPosts);
    
    if (posts.length > 0) {
      console.log(`[RSS] r/${subreddit} (${sortMode}): ${posts.length} posts (no engagement data)`);
    }

  } catch (error) {
    console.log(`[RSS] Error r/${subreddit}: ${error}`);
  }

  return { posts, comments, method: 'rss' };
}

// FALLBACK 3: Arctic Shift API (archive data with engagement) - only supports 'top' by score
async function scrapeViaArcticShift(
  subreddit: string,
  timeRange: TimeRange,
  limit: number = 50
): Promise<{ posts: RedditPost[]; comments: RedditComment[]; method: string }> {
  const posts: RedditPost[] = [];
  const comments: RedditComment[] = [];
  const scrapedAt = new Date().toISOString();
  const afterTimestamp = getTimestampForRange(timeRange);

  try {
    // Fetch posts sorted by score (top)
    const postsUrl = `https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=${subreddit}&after=${afterTimestamp}&limit=${limit}&sort=desc&sort_type=score`;
    
    const postsResponse = await fetch(postsUrl, {
      headers: { 'User-Agent': 'ResearchSentimentTracker/1.0' }
    });

    if (!postsResponse.ok) {
      console.log(`[Arctic] Failed r/${subreddit}: ${postsResponse.status}`);
      return { posts, comments, method: 'arctic_failed' };
    }

    const postsData = await postsResponse.json();
    const postsArray = postsData?.data || postsData || [];

    if (!Array.isArray(postsArray) || postsArray.length === 0) {
      return { posts, comments, method: 'arctic_empty' };
    }

    for (const p of postsArray) {
      if (p.author === '[deleted]' || p.removed_by_category) continue;

      posts.push({
        id: p.id,
        parsedId: `t3_${p.id}`,
        url: `https://www.reddit.com${p.permalink || `/r/${subreddit}/comments/${p.id}`}`,
        username: p.author || '[unknown]',
        userId: p.author_fullname || '',
        title: p.title || '',
        communityName: `r/${subreddit}`,
        parsedCommunityName: subreddit,
        body: p.selftext || '',
        html: '',
        link: p.url || '',
        numberOfComments: p.num_comments || 0,
        flair: p.link_flair_text || '',
        upVotes: p.score || 0,
        upVoteRatio: p.upvote_ratio || 0,
        isVideo: p.is_video || false,
        isAd: false,
        over18: p.over_18 || false,
        thumbnailUrl: p.thumbnail || '',
        createdAt: new Date((p.created_utc || p.created) * 1000).toISOString(),
        scrapedAt,
        dataType: 'post'
      });
    }

    // Fetch comments
    try {
      const commentsUrl = `https://arctic-shift.photon-reddit.com/api/comments/search?subreddit=${subreddit}&after=${afterTimestamp}&limit=${Math.min(limit, 50)}&sort=desc&sort_type=score`;
      
      const commentsResponse = await fetch(commentsUrl, {
        headers: { 'User-Agent': 'ResearchSentimentTracker/1.0' }
      });

      if (commentsResponse.ok) {
        const commentsData = await commentsResponse.json();
        const commentsArray = commentsData?.data || commentsData || [];

        if (Array.isArray(commentsArray)) {
          for (const c of commentsArray) {
            if (!c.body || c.body === '[deleted]' || c.body === '[removed]' || c.author === '[deleted]') continue;

            comments.push({
              id: c.id,
              parsedId: `t1_${c.id}`,
              url: `https://www.reddit.com${c.permalink || ''}`,
              postId: c.link_id || '',
              parentId: c.parent_id || '',
              username: c.author || '[unknown]',
              userId: c.author_fullname || '',
              category: '',
              communityName: `r/${subreddit}`,
              body: c.body,
              createdAt: new Date((c.created_utc || c.created) * 1000).toISOString(),
              scrapedAt,
              upVotes: c.score || 0,
              numberOfreplies: 0,
              html: '',
              dataType: 'comment'
            });
          }
        }
      }
    } catch {
      // Comments are optional
    }

    if (posts.length > 0) {
      const avgUpvotes = Math.round(posts.reduce((a, p) => a + p.upVotes, 0) / posts.length);
      console.log(`[Arctic] r/${subreddit}: ${posts.length} posts (avg ${avgUpvotes} upvotes), ${comments.length} comments`);
    }

    return { posts, comments, method: 'arctic' };

  } catch (error) {
    console.log(`[Arctic] Error r/${subreddit}: ${error}`);
    return { posts, comments, method: 'arctic_error' };
  }
}

// Scrape with fallback chain: OAuth → JSON → RSS → Arctic Shift
async function scrapeWithFallback(
  subreddit: string,
  timeRange: TimeRange,
  sortMode: SortMode,
  limit: number
): Promise<{ posts: RedditPost[]; comments: RedditComment[]; method: string; success: boolean }> {
  
  // Try Reddit OAuth first (best - authenticated, proper sorting, full data)
  const oauthResult = await scrapeViaRedditOAuth(subreddit, timeRange, sortMode, limit);
  if (oauthResult.posts.length > 0) {
    return { ...oauthResult, success: true };
  }

  // Try public JSON endpoint (may get rate limited)
  const jsonResult = await scrapeViaRedditJSON(subreddit, timeRange, sortMode, limit);
  if (jsonResult.posts.length > 0) {
    return { ...jsonResult, success: true };
  }

  // Try RSS (no engagement data but reliable)
  const rssResult = await scrapeViaRSS(subreddit, timeRange, sortMode);
  if (rssResult.posts.length > 0) {
    return { ...rssResult, success: true };
  }

  // Last resort: Arctic Shift (only has 'top' by score, historical data)
  if (sortMode === 'top') {
    const arcticResult = await scrapeViaArcticShift(subreddit, timeRange, limit);
    if (arcticResult.posts.length > 0) {
      return { ...arcticResult, success: true };
    }
  }

  return { posts: [], comments: [], method: 'all_failed', success: false };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      subreddits, 
      timeRange = 'day',
      sortMode = 'top',
      postsPerSubreddit = 25,
      saveToDb = true,
      fastMode = true
    } = await req.json();

    const targetSubreddits = subreddits || (fastMode ? FAST_MODE_SUBREDDITS : DEFAULT_SUBREDDITS);
    
    console.log(`[Scraper] Starting: ${targetSubreddits.length} subreddits, timeRange=${timeRange}, sortMode=${sortMode}, fastMode=${fastMode}`);

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const jwt = authHeader.replace('Bearer ', '');
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Scrape with optimized parallelism
    const allPosts: RedditPost[] = [];
    const allComments: RedditComment[] = [];
    const subredditStats: Record<string, { posts: number; comments: number; method: string }> = {};
    const failedSubreddits: string[] = [];
    const methodStats = { oauth: 0, json: 0, rss: 0, arctic: 0, failed: 0 };

    // Batch size 3 for API requests to avoid rate limiting
    const batchSize = 3;
    const delayBetweenBatches = 1000; // 1 second between batches

    for (let i = 0; i < targetSubreddits.length; i += batchSize) {
      if (isNearTimeout()) {
        console.log(`[Scraper] Approaching timeout at batch ${Math.floor(i/batchSize) + 1}, returning partial results`);
        break;
      }

      const batch = targetSubreddits.slice(i, i + batchSize);
      console.log(`[Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(targetSubreddits.length/batchSize)}] ${batch.join(', ')}`);
      
      const batchResults = await Promise.all(
        batch.map((sub: string) => scrapeWithFallback(sub, timeRange as TimeRange, sortMode as SortMode, postsPerSubreddit))
      );

      for (let j = 0; j < batch.length; j++) {
        const subreddit = batch[j];
        const { posts, comments, method, success } = batchResults[j];
        
        if (!success) {
          failedSubreddits.push(subreddit);
          methodStats.failed++;
        } else {
          if (method === 'oauth') methodStats.oauth++;
          else if (method === 'json') methodStats.json++;
          else if (method === 'rss') methodStats.rss++;
          else if (method === 'arctic') methodStats.arctic++;
        }
        
        allPosts.push(...posts);
        allComments.push(...comments);
        subredditStats[subreddit] = { posts: posts.length, comments: comments.length, method };
      }

      // Delay between batches to avoid rate limiting
      if (i + batchSize < targetSubreddits.length && !isNearTimeout()) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    const totalUpvotes = allPosts.reduce((a, p) => a + p.upVotes, 0);
    const avgUpvotes = allPosts.length > 0 ? Math.round(totalUpvotes / allPosts.length) : 0;
    const postsWithEngagement = allPosts.filter(p => p.upVotes > 0 || p.numberOfComments > 0).length;
    
    console.log(`[Scraper] Raw total: ${allPosts.length} posts (${postsWithEngagement} with engagement, avg ${avgUpvotes} upvotes), ${allComments.length} comments`);
    console.log(`[Scraper] Methods: OAuth=${methodStats.oauth}, JSON=${methodStats.json}, RSS=${methodStats.rss}, Arctic=${methodStats.arctic}, Failed=${methodStats.failed}`);

    // Sort by engagement
    allPosts.sort((a, b) => (b.upVotes + b.numberOfComments) - (a.upVotes + a.numberOfComments));
    allComments.sort((a, b) => b.upVotes - a.upVotes);

    // Filter by time range
    const cutoffTimestamp = getTimestampForRange(timeRange as TimeRange) * 1000;
    const filteredPosts = allPosts.filter(p => new Date(p.createdAt).getTime() >= cutoffTimestamp);
    const filteredComments = allComments.filter(c => new Date(c.createdAt).getTime() >= cutoffTimestamp);

    console.log(`[Scraper] After filter: ${filteredPosts.length} posts, ${filteredComments.length} comments`);

    // Save to database
    let dataSourceId = null;
    const finalData = [...filteredPosts, ...filteredComments];
    
    if (saveToDb && finalData.length > 0) {
      const timeRangeLabel = {
        'day': 'Today',
        '3days': 'Past 3 Days',
        'week': 'Past Week',
        'month': 'Past Month'
      }[timeRange as string] || timeRange;

      const sortModeLabel = {
        'top': 'Top',
        'hot': 'Hot',
        'rising': 'Rising'
      }[sortMode as string] || sortMode;

      const { data: dataSource, error: insertError } = await supabase
        .from('data_sources')
        .insert({
          user_id: user.id,
          name: `Reddit ${sortModeLabel} - ${timeRangeLabel} (${new Date().toLocaleDateString()})`,
          source_type: 'reddit_json',
          url: null,
          content: {
            posts: filteredPosts,
            comments: filteredComments,
            subredditStats,
            timeRange,
            sortMode,
            fastMode,
            failedSubreddits,
            methodStats,
            scrapedAt: new Date().toISOString(),
            totalSubreddits: targetSubreddits.length
          },
          item_count: finalData.length
        })
        .select()
        .single();

      if (insertError) {
        console.error('[DB] Insert error:', insertError);
      } else {
        dataSourceId = dataSource.id;
        console.log(`[DB] Saved: ${dataSourceId}`);
      }
    }

    const successCount = Object.keys(subredditStats).filter(k => subredditStats[k].posts > 0).length;

    return new Response(
      JSON.stringify({
        success: true,
        dataSourceId,
        summary: {
          totalPosts: filteredPosts.length,
          totalComments: filteredComments.length,
          postsWithEngagement,
          avgUpvotes,
          subredditsScraped: successCount,
          subredditsRequested: targetSubreddits.length,
          failedSubreddits: failedSubreddits.length,
          timeRange,
          sortMode,
          fastMode,
          methodStats,
          subredditStats
        },
        data: finalData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Scraper] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
