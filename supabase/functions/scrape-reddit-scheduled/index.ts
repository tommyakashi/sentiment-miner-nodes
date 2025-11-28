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

async function scrapeSubredditPullpush(
  subreddit: string, 
  limit: number = 30
): Promise<{ posts: RedditPost[]; comments: RedditComment[] }> {
  const posts: RedditPost[] = [];
  const comments: RedditComment[] = [];
  const scrapedAt = new Date().toISOString();
  // Last 24 hours
  const afterTimestamp = Math.floor(Date.now() / 1000) - (24 * 60 * 60);

  try {
    // Fetch posts using Pullpush.io API
    const postsUrl = `https://api.pullpush.io/reddit/search/submission/?subreddit=${subreddit}&after=${afterTimestamp}&size=${limit}&sort=desc&sort_type=score`;
    console.log(`[Scheduled] Fetching posts: ${postsUrl}`);

    const postsResponse = await fetch(postsUrl, {
      headers: {
        'User-Agent': 'ResearchSentimentTracker/1.0'
      }
    });

    if (!postsResponse.ok) {
      console.error(`[Scheduled] Failed to fetch posts from r/${subreddit}: ${postsResponse.status}`);
      return { posts, comments };
    }

    const postsData = await postsResponse.json();
    
    if (!postsData?.data || postsData.data.length === 0) {
      console.log(`[Scheduled] No posts found in r/${subreddit}`);
      return { posts, comments };
    }

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
    const commentsUrl = `https://api.pullpush.io/reddit/search/comment/?subreddit=${subreddit}&after=${afterTimestamp}&size=${Math.min(limit * 2, 50)}&sort=desc&sort_type=score`;
    
    const commentsResponse = await fetch(commentsUrl, {
      headers: {
        'User-Agent': 'ResearchSentimentTracker/1.0'
      }
    });

    if (commentsResponse.ok) {
      const commentsData = await commentsResponse.json();
      
      if (commentsData?.data && commentsData.data.length > 0) {
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
    }

    console.log(`[Scheduled] r/${subreddit}: ${posts.length} posts, ${comments.length} comments`);
    return { posts, comments };

  } catch (error) {
    console.error(`[Scheduled] Error scraping r/${subreddit}:`, error);
    return { posts, comments };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[Scheduled] Starting daily Reddit scrape job via Pullpush.io...');

  try {
    // Use service role for scheduled jobs (no user auth)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const allPosts: RedditPost[] = [];
    const allComments: RedditComment[] = [];
    const subredditStats: Record<string, { posts: number; comments: number }> = {};

    // Process in batches of 3
    const batchSize = 3;
    for (let i = 0; i < DEFAULT_SUBREDDITS.length; i += batchSize) {
      const batch = DEFAULT_SUBREDDITS.slice(i, i + batchSize);
      
      console.log(`[Scheduled] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(DEFAULT_SUBREDDITS.length/batchSize)}`);
      
      const batchResults = await Promise.all(
        batch.map((sub: string) => scrapeSubredditPullpush(sub, 20))
      );

      for (let j = 0; j < batch.length; j++) {
        const subreddit = batch[j];
        const { posts, comments } = batchResults[j];
        
        allPosts.push(...posts);
        allComments.push(...comments);
        subredditStats[subreddit] = { posts: posts.length, comments: comments.length };
      }

      // Delay between batches
      if (i + batchSize < DEFAULT_SUBREDDITS.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`[Scheduled] Total scraped: ${allPosts.length} posts, ${allComments.length} comments`);

    const allData = [...allPosts, ...allComments];

    if (allData.length > 0) {
      // Get all users who have used the app (have data_sources) to save for them
      const { data: users, error: usersError } = await supabase
        .from('data_sources')
        .select('user_id')
        .limit(100);

      const uniqueUserIds = [...new Set((users || []).map(u => u.user_id))];
      
      console.log(`[Scheduled] Saving to ${uniqueUserIds.length} users`);

      // Save for each user
      for (const userId of uniqueUserIds) {
        const { error: insertError } = await supabase
          .from('data_sources')
          .insert({
            user_id: userId,
            name: `Reddit Scheduled - Daily (${new Date().toLocaleDateString()})`,
            source_type: 'reddit_scheduled',
            url: null,
            content: {
              posts: allPosts,
              comments: allComments,
              subredditStats,
              timeRange: 'day',
              scrapedAt: new Date().toISOString(),
              totalSubreddits: DEFAULT_SUBREDDITS.length,
              isScheduled: true
            },
            item_count: allData.length
          });

        if (insertError) {
          console.error(`[Scheduled] Error saving for user ${userId}:`, insertError);
        }
      }
    }

    console.log('[Scheduled] Daily scrape job completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          totalPosts: allPosts.length,
          totalComments: allComments.length,
          subredditsScraped: Object.keys(subredditStats).filter(k => subredditStats[k].posts > 0 || subredditStats[k].comments > 0).length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Scheduled] Error in scheduled scrape:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
