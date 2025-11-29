import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default subreddits for research sentiment tracking
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
type DataSource = 'rss' | 'arctic_shift' | 'pullpush';

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

function selectDataSource(timeRange: TimeRange): DataSource {
  switch (timeRange) {
    case 'day':
    case '3days':
      return 'rss'; // Real-time from RSS feeds
    case 'week':
    case 'month':
      return 'arctic_shift'; // Recent archive data
    default:
      return 'rss';
  }
}

// Parse RSS XML to extract posts
function parseRSSXML(xmlText: string, subreddit: string, scrapedAt: string): RedditPost[] {
  const posts: RedditPost[] = [];
  
  // Simple XML parsing for RSS feed
  const entryMatches = xmlText.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  
  for (const entry of entryMatches) {
    try {
      // Extract ID
      const idMatch = entry.match(/<id>([^<]+)<\/id>/);
      const id = idMatch ? idMatch[1].split('/').pop() || '' : '';
      
      // Extract title
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
      const title = titleMatch ? decodeHTMLEntities(titleMatch[1]) : '';
      
      // Extract link
      const linkMatch = entry.match(/<link href="([^"]+)"/);
      const url = linkMatch ? linkMatch[1] : '';
      
      // Extract author
      const authorMatch = entry.match(/<author><name>\/u\/([^<]+)<\/name><\/author>/);
      const username = authorMatch ? authorMatch[1] : '[unknown]';
      
      // Extract published date
      const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
      const createdAt = publishedMatch ? publishedMatch[1] : new Date().toISOString();
      
      // Extract content/body
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
          upVotes: 0, // RSS doesn't provide upvotes
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
      console.error('Error parsing RSS entry:', e);
    }
  }
  
  return posts;
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

// Scrape via Reddit RSS feeds (real-time, works reliably)
async function scrapeViaRSS(
  subreddit: string
): Promise<{ posts: RedditPost[]; comments: RedditComment[] }> {
  const posts: RedditPost[] = [];
  const comments: RedditComment[] = [];
  const scrapedAt = new Date().toISOString();

  try {
    // Try new posts first
    const rssUrl = `https://www.reddit.com/r/${subreddit}/new/.rss`;
    console.log(`[RSS] Fetching: ${rssUrl}`);

    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    });

    if (!response.ok) {
      console.error(`[RSS] Failed to fetch r/${subreddit}: ${response.status}`);
      return { posts, comments };
    }

    const xmlText = await response.text();
    const parsedPosts = parseRSSXML(xmlText, subreddit, scrapedAt);
    posts.push(...parsedPosts);

    console.log(`[RSS] r/${subreddit}: ${posts.length} posts`);
    return { posts, comments };

  } catch (error) {
    console.error(`[RSS] Error scraping r/${subreddit}:`, error);
    return { posts, comments };
  }
}

// Scrape via Arctic Shift API (recent archive, up to Oct 2025)
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
    // Fetch posts from Arctic Shift
    const postsUrl = `https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=${subreddit}&after=${afterTimestamp}&limit=${limit}&sort=desc&sort_type=score`;
    console.log(`[ArcticShift] Fetching posts: ${postsUrl}`);

    const postsResponse = await fetch(postsUrl, {
      headers: {
        'User-Agent': 'ResearchSentimentTracker/1.0'
      }
    });

    if (!postsResponse.ok) {
      console.error(`[ArcticShift] Failed to fetch posts from r/${subreddit}: ${postsResponse.status}`);
      // Fallback to RSS if Arctic Shift fails
      console.log(`[ArcticShift] Falling back to RSS for r/${subreddit}`);
      return scrapeViaRSS(subreddit);
    }

    const postsData = await postsResponse.json();
    const postsArray = postsData?.data || postsData || [];

    if (!Array.isArray(postsArray) || postsArray.length === 0) {
      console.log(`[ArcticShift] No posts found in r/${subreddit}, trying RSS fallback`);
      return scrapeViaRSS(subreddit);
    }

    console.log(`[ArcticShift] Found ${postsArray.length} posts in r/${subreddit}`);

    for (const postData of postsArray) {
      if (postData.author === '[deleted]' || postData.removed_by_category) continue;

      const createdAt = new Date((postData.created_utc || postData.created) * 1000);

      const post: RedditPost = {
        id: postData.id,
        parsedId: `t3_${postData.id}`,
        url: `https://www.reddit.com${postData.permalink || `/r/${subreddit}/comments/${postData.id}`}`,
        username: postData.author || '[unknown]',
        userId: postData.author_fullname || '',
        title: postData.title || '',
        communityName: `r/${subreddit}`,
        parsedCommunityName: subreddit,
        body: postData.selftext || '',
        html: '',
        link: postData.url || '',
        numberOfComments: postData.num_comments || 0,
        flair: postData.link_flair_text || '',
        upVotes: postData.score || 0,
        upVoteRatio: postData.upvote_ratio || 0,
        isVideo: postData.is_video || false,
        isAd: false,
        over18: postData.over_18 || false,
        thumbnailUrl: postData.thumbnail || '',
        createdAt: createdAt.toISOString(),
        scrapedAt,
        dataType: 'post'
      };

      posts.push(post);
    }

    // Try to fetch comments from Arctic Shift
    try {
      const commentsUrl = `https://arctic-shift.photon-reddit.com/api/comments/search?subreddit=${subreddit}&after=${afterTimestamp}&limit=${Math.min(limit * 2, 100)}&sort=desc&sort_type=score`;
      console.log(`[ArcticShift] Fetching comments: ${commentsUrl}`);

      const commentsResponse = await fetch(commentsUrl, {
        headers: {
          'User-Agent': 'ResearchSentimentTracker/1.0'
        }
      });

      if (commentsResponse.ok) {
        const commentsData = await commentsResponse.json();
        const commentsArray = commentsData?.data || commentsData || [];

        if (Array.isArray(commentsArray) && commentsArray.length > 0) {
          console.log(`[ArcticShift] Found ${commentsArray.length} comments in r/${subreddit}`);

          for (const commentData of commentsArray) {
            if (!commentData.body || 
                commentData.body === '[deleted]' || 
                commentData.body === '[removed]' ||
                commentData.author === '[deleted]') {
              continue;
            }

            const createdAt = new Date((commentData.created_utc || commentData.created) * 1000);

            const comment: RedditComment = {
              id: commentData.id,
              parsedId: `t1_${commentData.id}`,
              url: `https://www.reddit.com${commentData.permalink || ''}`,
              postId: commentData.link_id || '',
              parentId: commentData.parent_id || '',
              username: commentData.author || '[unknown]',
              userId: commentData.author_fullname || '',
              category: '',
              communityName: `r/${subreddit}`,
              body: commentData.body,
              createdAt: createdAt.toISOString(),
              scrapedAt,
              upVotes: commentData.score || 0,
              numberOfreplies: 0,
              html: '',
              dataType: 'comment'
            };

            comments.push(comment);
          }
        }
      }
    } catch (commentError) {
      console.error(`[ArcticShift] Error fetching comments for r/${subreddit}:`, commentError);
    }

    console.log(`[ArcticShift] r/${subreddit}: ${posts.length} posts, ${comments.length} comments`);
    return { posts, comments };

  } catch (error) {
    console.error(`[ArcticShift] Error scraping r/${subreddit}:`, error);
    // Fallback to RSS
    console.log(`[ArcticShift] Falling back to RSS for r/${subreddit}`);
    return scrapeViaRSS(subreddit);
  }
}

// Main scraping function that selects the best source
async function scrapeSubreddit(
  subreddit: string,
  timeRange: TimeRange,
  limit: number = 50
): Promise<{ posts: RedditPost[]; comments: RedditComment[] }> {
  const source = selectDataSource(timeRange);
  
  console.log(`[Scraper] Using ${source} for r/${subreddit} (timeRange: ${timeRange})`);
  
  switch (source) {
    case 'rss':
      return scrapeViaRSS(subreddit);
    case 'arctic_shift':
      return scrapeViaArcticShift(subreddit, timeRange, limit);
    default:
      return scrapeViaRSS(subreddit);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      subreddits = DEFAULT_SUBREDDITS, 
      timeRange = 'day',
      postsPerSubreddit = 50,
      saveToDb = true
    } = await req.json();

    const source = selectDataSource(timeRange as TimeRange);
    console.log(`Starting bulk Reddit scrape: ${subreddits.length} subreddits, timeRange=${timeRange}, source=${source}`);

    // Get auth header
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
      global: {
        headers: {
          Authorization: `Bearer ${jwt}`
        }
      }
    });

    // Get user from auth token
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Scrape all subreddits with concurrency limit
    const allPosts: RedditPost[] = [];
    const allComments: RedditComment[] = [];
    const subredditStats: Record<string, { posts: number; comments: number }> = {};

    // Process in batches (smaller for RSS to avoid rate limiting)
    const batchSize = source === 'rss' ? 2 : 3;
    const delayBetweenBatches = source === 'rss' ? 1500 : 500;

    for (let i = 0; i < subreddits.length; i += batchSize) {
      const batch = subreddits.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(subreddits.length/batchSize)}: ${batch.join(', ')}`);
      
      const batchResults = await Promise.all(
        batch.map((sub: string) => scrapeSubreddit(sub, timeRange as TimeRange, postsPerSubreddit))
      );

      for (let j = 0; j < batch.length; j++) {
        const subreddit = batch[j];
        const { posts, comments } = batchResults[j];
        
        allPosts.push(...posts);
        allComments.push(...comments);
        subredditStats[subreddit] = { posts: posts.length, comments: comments.length };
      }

      // Delay between batches to avoid rate limiting
      if (i + batchSize < subreddits.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    console.log(`Total scraped: ${allPosts.length} posts, ${allComments.length} comments`);

    // Combine all data
    const allData = [...allPosts, ...allComments];

    // Sort by engagement (upvotes) - RSS posts won't have upvotes
    allPosts.sort((a, b) => b.upVotes - a.upVotes);
    allComments.sort((a, b) => b.upVotes - a.upVotes);

    // Filter by time range for RSS posts (they come without timestamp filtering)
    const cutoffTimestamp = getTimestampForRange(timeRange as TimeRange) * 1000;
    const filteredPosts = allPosts.filter(p => new Date(p.createdAt).getTime() >= cutoffTimestamp);
    const filteredComments = allComments.filter(c => new Date(c.createdAt).getTime() >= cutoffTimestamp);

    console.log(`After time filtering: ${filteredPosts.length} posts, ${filteredComments.length} comments`);

    // Save to database if requested
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
          name: `Reddit Bulk Scrape - ${timeRangeLabel} (${new Date().toLocaleDateString()})`,
          source_type: 'reddit_bulk',
          url: null,
          content: {
            posts: filteredPosts,
            comments: filteredComments,
            subredditStats,
            timeRange,
            dataSource: source,
            scrapedAt: new Date().toISOString(),
            totalSubreddits: subreddits.length
          },
          item_count: finalData.length
        })
        .select()
        .single();

      if (insertError) {
        console.error('Database insert error:', insertError);
      } else {
        dataSourceId = dataSource.id;
        console.log(`Saved to data_sources: ${dataSourceId}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dataSourceId,
        summary: {
          totalPosts: filteredPosts.length,
          totalComments: filteredComments.length,
          subredditsScraped: Object.keys(subredditStats).filter(k => subredditStats[k].posts > 0 || subredditStats[k].comments > 0).length,
          timeRange,
          dataSource: source,
          subredditStats
        },
        data: finalData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in scrape-reddit-bulk function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
