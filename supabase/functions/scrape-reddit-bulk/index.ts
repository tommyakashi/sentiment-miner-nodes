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

function getTimeFilter(timeRange: TimeRange): { sort: string; t: string; cutoffDate: Date } {
  const now = new Date();
  let cutoffDate: Date;
  let sort = 'top';
  let t = 'day';

  switch (timeRange) {
    case 'day':
      cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      t = 'day';
      break;
    case '3days':
      cutoffDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      t = 'week'; // Reddit doesn't have 3day, use week and filter
      break;
    case 'week':
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      t = 'week';
      break;
    case 'month':
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      t = 'month';
      break;
    default:
      cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      t = 'day';
  }

  return { sort, t, cutoffDate };
}

async function scrapeSubreddit(
  subreddit: string, 
  timeRange: TimeRange, 
  limit: number = 10
): Promise<{ posts: RedditPost[]; comments: RedditComment[] }> {
  const { sort, t, cutoffDate } = getTimeFilter(timeRange);
  const posts: RedditPost[] = [];
  const comments: RedditComment[] = [];
  const scrapedAt = new Date().toISOString();

  try {
    // Fetch top posts for the time period
    const listingUrl = `https://www.reddit.com/r/${subreddit}/${sort}.json?t=${t}&limit=${limit}`;
    console.log(`Fetching: ${listingUrl}`);

    const listingResponse = await fetch(listingUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!listingResponse.ok) {
      console.error(`Failed to fetch r/${subreddit}: ${listingResponse.status}`);
      return { posts, comments };
    }

    const listingData = await listingResponse.json();
    
    if (!listingData?.data?.children) {
      console.log(`No posts found in r/${subreddit}`);
      return { posts, comments };
    }

    // Process each post
    for (const child of listingData.data.children) {
      if (child.kind !== 't3') continue;
      
      const postData = child.data;
      const createdAt = new Date(postData.created_utc * 1000);
      
      // Filter by cutoff date for 3days range
      if (timeRange === '3days' && createdAt < cutoffDate) continue;
      
      // Skip deleted/removed posts
      if (postData.author === '[deleted]' || postData.removed_by_category) continue;

      const post: RedditPost = {
        id: postData.id,
        parsedId: `t3_${postData.id}`,
        url: `https://www.reddit.com${postData.permalink}`,
        username: postData.author,
        userId: postData.author_fullname || '',
        title: postData.title,
        communityName: `r/${subreddit}`,
        parsedCommunityName: subreddit,
        body: postData.selftext || '',
        html: postData.selftext_html || '',
        link: postData.url,
        numberOfComments: postData.num_comments,
        flair: postData.link_flair_text || '',
        upVotes: postData.score,
        upVoteRatio: postData.upvote_ratio,
        isVideo: postData.is_video,
        isAd: postData.promoted || false,
        over18: postData.over_18,
        thumbnailUrl: postData.thumbnail || '',
        createdAt: createdAt.toISOString(),
        scrapedAt,
        dataType: 'post'
      };

      posts.push(post);

      // Fetch comments for high-engagement posts (score > 10 or num_comments > 5)
      if (postData.score > 10 || postData.num_comments > 5) {
        try {
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          
          const commentsUrl = `https://www.reddit.com/r/${subreddit}/comments/${postData.id}.json?limit=50`;
          const commentsResponse = await fetch(commentsUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });

          if (commentsResponse.ok) {
            const commentsData = await commentsResponse.json();
            if (commentsData[1]?.data?.children) {
              const extractedComments = extractComments(
                commentsData[1].data.children, 
                postData.id, 
                subreddit, 
                scrapedAt,
                cutoffDate,
                timeRange
              );
              comments.push(...extractedComments);
            }
          }
        } catch (commentError) {
          console.error(`Error fetching comments for post ${postData.id}:`, commentError);
        }
      }
    }

    console.log(`r/${subreddit}: ${posts.length} posts, ${comments.length} comments`);
    return { posts, comments };

  } catch (error) {
    console.error(`Error scraping r/${subreddit}:`, error);
    return { posts, comments };
  }
}

function extractComments(
  children: any[], 
  postId: string, 
  subreddit: string, 
  scrapedAt: string,
  cutoffDate: Date,
  timeRange: TimeRange
): RedditComment[] {
  const comments: RedditComment[] = [];

  for (const child of children) {
    if (child.kind !== 't1' || !child.data) continue;
    
    const commentData = child.data;
    
    // Skip deleted/removed comments
    if (!commentData.body || 
        commentData.body === '[deleted]' || 
        commentData.body === '[removed]' ||
        commentData.author === '[deleted]') {
      continue;
    }

    const createdAt = new Date(commentData.created_utc * 1000);
    
    // Filter by cutoff date for 3days range
    if (timeRange === '3days' && createdAt < cutoffDate) continue;

    const comment: RedditComment = {
      id: commentData.id,
      parsedId: `t1_${commentData.id}`,
      url: `https://www.reddit.com${commentData.permalink}`,
      postId: `t3_${postId}`,
      parentId: commentData.parent_id,
      username: commentData.author,
      userId: commentData.author_fullname || '',
      category: '',
      communityName: `r/${subreddit}`,
      body: commentData.body,
      createdAt: createdAt.toISOString(),
      scrapedAt,
      upVotes: commentData.score,
      numberOfreplies: commentData.replies?.data?.children?.length || 0,
      html: commentData.body_html || '',
      dataType: 'comment'
    };

    comments.push(comment);

    // Recursively get replies (limit depth)
    if (commentData.replies?.data?.children && comments.length < 200) {
      const replies = extractComments(
        commentData.replies.data.children, 
        postId, 
        subreddit, 
        scrapedAt,
        cutoffDate,
        timeRange
      );
      comments.push(...replies);
    }
  }

  return comments;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      subreddits = DEFAULT_SUBREDDITS, 
      timeRange = 'day',
      postsPerSubreddit = 10,
      saveToDb = true
    } = await req.json();

    console.log(`Starting bulk Reddit scrape: ${subreddits.length} subreddits, timeRange=${timeRange}`);

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
    
    // Create client with anon key, then set auth header with JWT
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

    // Process in batches of 5 to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < subreddits.length; i += batchSize) {
      const batch = subreddits.slice(i, i + batchSize);
      
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

      // Delay between batches
      if (i + batchSize < subreddits.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Total scraped: ${allPosts.length} posts, ${allComments.length} comments`);

    // Combine all data
    const allData = [...allPosts, ...allComments];

    // Sort by engagement (upvotes)
    allPosts.sort((a, b) => b.upVotes - a.upVotes);
    allComments.sort((a, b) => b.upVotes - a.upVotes);

    // Save to database if requested
    let dataSourceId = null;
    if (saveToDb && allData.length > 0) {
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
            posts: allPosts,
            comments: allComments,
            subredditStats,
            timeRange,
            scrapedAt: new Date().toISOString(),
            totalSubreddits: subreddits.length
          },
          item_count: allData.length
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
          totalPosts: allPosts.length,
          totalComments: allComments.length,
          subredditsScraped: Object.keys(subredditStats).length,
          timeRange,
          subredditStats
        },
        // Return the data for immediate analysis
        data: allData
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
