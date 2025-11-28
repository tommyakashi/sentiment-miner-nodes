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

async function scrapeSubredditPullpush(
  subreddit: string, 
  timeRange: TimeRange, 
  limit: number = 50
): Promise<{ posts: RedditPost[]; comments: RedditComment[] }> {
  const posts: RedditPost[] = [];
  const comments: RedditComment[] = [];
  const scrapedAt = new Date().toISOString();
  const afterTimestamp = getTimestampForRange(timeRange);

  try {
    // Fetch posts using Pullpush.io API
    const postsUrl = `https://api.pullpush.io/reddit/search/submission/?subreddit=${subreddit}&after=${afterTimestamp}&size=${limit}&sort=desc&sort_type=score`;
    console.log(`Fetching posts: ${postsUrl}`);

    const postsResponse = await fetch(postsUrl, {
      headers: {
        'User-Agent': 'ResearchSentimentTracker/1.0'
      }
    });

    if (!postsResponse.ok) {
      console.error(`Failed to fetch posts from r/${subreddit}: ${postsResponse.status}`);
      return { posts, comments };
    }

    const postsData = await postsResponse.json();
    
    if (!postsData?.data || postsData.data.length === 0) {
      console.log(`No posts found in r/${subreddit} for time range ${timeRange}`);
      return { posts, comments };
    }

    console.log(`Found ${postsData.data.length} posts in r/${subreddit}`);

    // Process each post from Pullpush response
    for (const postData of postsData.data) {
      // Skip deleted/removed posts
      if (postData.author === '[deleted]' || postData.removed_by_category) continue;

      const createdAt = new Date(postData.created_utc * 1000);

      const post: RedditPost = {
        id: postData.id,
        parsedId: `t3_${postData.id}`,
        url: `https://www.reddit.com${postData.permalink}`,
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

    // Fetch comments using Pullpush.io API
    const commentsUrl = `https://api.pullpush.io/reddit/search/comment/?subreddit=${subreddit}&after=${afterTimestamp}&size=${Math.min(limit * 3, 100)}&sort=desc&sort_type=score`;
    console.log(`Fetching comments: ${commentsUrl}`);

    const commentsResponse = await fetch(commentsUrl, {
      headers: {
        'User-Agent': 'ResearchSentimentTracker/1.0'
      }
    });

    if (commentsResponse.ok) {
      const commentsData = await commentsResponse.json();
      
      if (commentsData?.data && commentsData.data.length > 0) {
        console.log(`Found ${commentsData.data.length} comments in r/${subreddit}`);

        for (const commentData of commentsData.data) {
          // Skip deleted/removed comments
          if (!commentData.body || 
              commentData.body === '[deleted]' || 
              commentData.body === '[removed]' ||
              commentData.author === '[deleted]') {
            continue;
          }

          const createdAt = new Date(commentData.created_utc * 1000);

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
    } else {
      console.error(`Failed to fetch comments from r/${subreddit}: ${commentsResponse.status}`);
    }

    console.log(`r/${subreddit}: ${posts.length} posts, ${comments.length} comments`);
    return { posts, comments };

  } catch (error) {
    console.error(`Error scraping r/${subreddit}:`, error);
    return { posts, comments };
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

    console.log(`Starting bulk Reddit scrape via Pullpush.io: ${subreddits.length} subreddits, timeRange=${timeRange}`);

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

    // Process in batches of 3 (Pullpush is more lenient but let's be safe)
    const batchSize = 3;
    for (let i = 0; i < subreddits.length; i += batchSize) {
      const batch = subreddits.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(subreddits.length/batchSize)}: ${batch.join(', ')}`);
      
      const batchResults = await Promise.all(
        batch.map((sub: string) => scrapeSubredditPullpush(sub, timeRange as TimeRange, postsPerSubreddit))
      );

      for (let j = 0; j < batch.length; j++) {
        const subreddit = batch[j];
        const { posts, comments } = batchResults[j];
        
        allPosts.push(...posts);
        allComments.push(...comments);
        subredditStats[subreddit] = { posts: posts.length, comments: comments.length };
      }

      // Small delay between batches
      if (i + batchSize < subreddits.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
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
          subredditsScraped: Object.keys(subredditStats).filter(k => subredditStats[k].posts > 0 || subredditStats[k].comments > 0).length,
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
