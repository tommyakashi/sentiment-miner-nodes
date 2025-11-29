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

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
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
          numberOfComments: 0,
          flair: '',
          upVotes: 0,
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
    } catch (e) {
      // Skip malformed entries
    }
  }
  
  return posts;
}

// Fetch comments for a specific post using Reddit JSON endpoint
async function fetchCommentsForPost(
  subreddit: string, 
  postId: string,
  scrapedAt: string
): Promise<RedditComment[]> {
  const comments: RedditComment[] = [];
  
  try {
    // Clean the postId (remove t3_ prefix if present)
    const cleanPostId = postId.replace('t3_', '');
    const url = `https://www.reddit.com/r/${subreddit}/comments/${cleanPostId}.json?limit=10&depth=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return comments;
    }

    const data = await response.json();
    
    // Reddit returns [post_data, comments_data]
    if (Array.isArray(data) && data.length >= 2) {
      const commentsListing = data[1]?.data?.children || [];
      
      for (const item of commentsListing) {
        if (item.kind !== 't1') continue;
        const c = item.data;
        
        if (!c.body || c.body === '[deleted]' || c.body === '[removed]' || c.author === '[deleted]') continue;
        
        comments.push({
          id: c.id,
          parsedId: `t1_${c.id}`,
          url: `https://www.reddit.com${c.permalink || ''}`,
          postId: `t3_${cleanPostId}`,
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
  } catch (error) {
    // Silently fail - comments are optional
  }
  
  return comments;
}

// RSS scrape with optional comment fetching
async function scrapeViaRSS(subreddit: string, fetchComments: boolean = true): Promise<{ posts: RedditPost[]; comments: RedditComment[] }> {
  const posts: RedditPost[] = [];
  const comments: RedditComment[] = [];
  const scrapedAt = new Date().toISOString();

  try {
    const rssUrl = `https://www.reddit.com/r/${subreddit}/new/.rss`;
    
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    });

    if (!response.ok) {
      console.log(`[RSS] Failed r/${subreddit}: ${response.status}`);
      return { posts, comments };
    }

    const xmlText = await response.text();
    const parsedPosts = parseRSSXML(xmlText, subreddit, scrapedAt);
    posts.push(...parsedPosts);
    
    // Fetch comments for top 3 posts (to stay within rate limits and timeout)
    if (fetchComments && posts.length > 0) {
      const topPosts = posts.slice(0, 3);
      const commentPromises = topPosts.map(post => 
        fetchCommentsForPost(subreddit, post.id, scrapedAt)
      );
      
      const commentResults = await Promise.all(commentPromises);
      for (const postComments of commentResults) {
        comments.push(...postComments);
      }
    }
    
    console.log(`[RSS] r/${subreddit}: ${posts.length} posts, ${comments.length} comments`);

  } catch (error) {
    console.log(`[RSS] Error r/${subreddit}: ${error}`);
  }

  return { posts, comments };
}

// Arctic Shift API (has engagement data - upvotes, comments)
async function scrapeViaArcticShift(
  subreddit: string,
  timeRange: TimeRange,
  limit: number = 50
): Promise<{ posts: RedditPost[]; comments: RedditComment[] }> {
  const posts: RedditPost[] = [];
  const comments: RedditComment[] = [];
  const scrapedAt = new Date().toISOString();
  const afterTimestamp = getTimestampForRange(timeRange);

  try {
    // Fetch posts
    const postsUrl = `https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=${subreddit}&after=${afterTimestamp}&limit=${limit}&sort=desc&sort_type=score`;
    
    const postsResponse = await fetch(postsUrl, {
      headers: { 'User-Agent': 'ResearchSentimentTracker/1.0' }
    });

    if (!postsResponse.ok) {
      console.log(`[Arctic] Failed r/${subreddit}, falling back to RSS`);
      return scrapeViaRSS(subreddit);
    }

    const postsData = await postsResponse.json();
    const postsArray = postsData?.data || postsData || [];

    if (!Array.isArray(postsArray) || postsArray.length === 0) {
      console.log(`[Arctic] No data r/${subreddit}, falling back to RSS`);
      return scrapeViaRSS(subreddit);
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

    // Fetch comments (parallel, non-blocking)
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
      // Comments are optional, continue without them
    }

    console.log(`[Arctic] r/${subreddit}: ${posts.length} posts, ${comments.length} comments`);
    return { posts, comments };

  } catch (error) {
    console.log(`[Arctic] Error r/${subreddit}, falling back to RSS: ${error}`);
    return scrapeViaRSS(subreddit);
  }
}

// Scrape with retry logic
async function scrapeWithRetry(
  subreddit: string,
  timeRange: TimeRange,
  limit: number,
  useArcticShift: boolean
): Promise<{ posts: RedditPost[]; comments: RedditComment[]; success: boolean }> {
  const scraper = useArcticShift 
    ? () => scrapeViaArcticShift(subreddit, timeRange, limit)
    : () => scrapeViaRSS(subreddit);
  
  try {
    const result = await scraper();
    return { ...result, success: result.posts.length > 0 };
  } catch {
    // One retry after 500ms
    await new Promise(r => setTimeout(r, 500));
    try {
      const result = await scraper();
      return { ...result, success: result.posts.length > 0 };
    } catch {
      return { posts: [], comments: [], success: false };
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      subreddits, 
      timeRange = 'day',
      postsPerSubreddit = 25,
      saveToDb = true,
      fastMode = true // Default to fast mode for speed
    } = await req.json();

    // Use fast mode subreddits if not specified or if fast mode enabled
    const targetSubreddits = subreddits || (fastMode ? FAST_MODE_SUBREDDITS : DEFAULT_SUBREDDITS);
    
    // Use Arctic Shift for all time ranges (has engagement data)
    // Only fall back to RSS if Arctic Shift fails
    const useArcticShift = true;
    
    console.log(`[Scraper] Starting: ${targetSubreddits.length} subreddits, timeRange=${timeRange}, fastMode=${fastMode}`);

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
    const subredditStats: Record<string, { posts: number; comments: number }> = {};
    const failedSubreddits: string[] = [];

    // Optimized: batch size 5, delay 500ms
    const batchSize = 5;
    const delayBetweenBatches = 500;

    for (let i = 0; i < targetSubreddits.length; i += batchSize) {
      // Check for timeout before each batch
      if (isNearTimeout()) {
        console.log(`[Scraper] Approaching timeout at batch ${Math.floor(i/batchSize) + 1}, returning partial results`);
        break;
      }

      const batch = targetSubreddits.slice(i, i + batchSize);
      console.log(`[Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(targetSubreddits.length/batchSize)}] ${batch.join(', ')}`);
      
      const batchResults = await Promise.all(
        batch.map((sub: string) => scrapeWithRetry(sub, timeRange as TimeRange, postsPerSubreddit, useArcticShift))
      );

      for (let j = 0; j < batch.length; j++) {
        const subreddit = batch[j];
        const { posts, comments, success } = batchResults[j];
        
        if (!success) {
          failedSubreddits.push(subreddit);
        }
        
        allPosts.push(...posts);
        allComments.push(...comments);
        subredditStats[subreddit] = { posts: posts.length, comments: comments.length };
      }

      // Brief delay between batches
      if (i + batchSize < targetSubreddits.length && !isNearTimeout()) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    console.log(`[Scraper] Raw total: ${allPosts.length} posts, ${allComments.length} comments`);
    if (failedSubreddits.length > 0) {
      console.log(`[Scraper] Failed subreddits: ${failedSubreddits.join(', ')}`);
    }

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

      const { data: dataSource, error: insertError } = await supabase
        .from('data_sources')
        .insert({
          user_id: user.id,
          name: `Reddit Scrape - ${timeRangeLabel} (${new Date().toLocaleDateString()})`,
          source_type: 'reddit_json',
          url: null,
          content: {
            posts: filteredPosts,
            comments: filteredComments,
            subredditStats,
            timeRange,
            fastMode,
            failedSubreddits,
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
          subredditsScraped: successCount,
          subredditsRequested: targetSubreddits.length,
          failedSubreddits: failedSubreddits.length,
          timeRange,
          fastMode,
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
