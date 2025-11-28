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

async function scrapeSubreddit(
  subreddit: string, 
  limit: number = 10
): Promise<{ posts: RedditPost[]; comments: RedditComment[] }> {
  const posts: RedditPost[] = [];
  const comments: RedditComment[] = [];
  const scrapedAt = new Date().toISOString();
  const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours

  try {
    const listingUrl = `https://www.reddit.com/r/${subreddit}/top.json?t=day&limit=${limit}`;
    console.log(`[Scheduled] Fetching: ${listingUrl}`);

    const listingResponse = await fetch(listingUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!listingResponse.ok) {
      console.error(`[Scheduled] Failed to fetch r/${subreddit}: ${listingResponse.status}`);
      return { posts, comments };
    }

    const listingData = await listingResponse.json();
    
    if (!listingData?.data?.children) {
      console.log(`[Scheduled] No posts found in r/${subreddit}`);
      return { posts, comments };
    }

    for (const child of listingData.data.children) {
      if (child.kind !== 't3') continue;
      
      const postData = child.data;
      const createdAt = new Date(postData.created_utc * 1000);
      
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

      // Fetch comments for high-engagement posts
      if (postData.score > 10 || postData.num_comments > 5) {
        try {
          await new Promise(resolve => setTimeout(resolve, 300));
          
          const commentsUrl = `https://www.reddit.com/r/${subreddit}/comments/${postData.id}.json?limit=30`;
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
                scrapedAt
              );
              comments.push(...extractedComments);
            }
          }
        } catch (commentError) {
          console.error(`[Scheduled] Error fetching comments for post ${postData.id}:`, commentError);
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

function extractComments(
  children: any[], 
  postId: string, 
  subreddit: string, 
  scrapedAt: string
): RedditComment[] {
  const comments: RedditComment[] = [];

  for (const child of children) {
    if (child.kind !== 't1' || !child.data) continue;
    
    const commentData = child.data;
    
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

    if (commentData.replies?.data?.children && comments.length < 100) {
      const replies = extractComments(
        commentData.replies.data.children, 
        postId, 
        subreddit, 
        scrapedAt
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

  console.log('[Scheduled] Starting daily Reddit scrape job...');

  try {
    // Use service role for scheduled jobs (no user auth)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const allPosts: RedditPost[] = [];
    const allComments: RedditComment[] = [];
    const subredditStats: Record<string, { posts: number; comments: number }> = {};

    // Process in batches of 5
    const batchSize = 5;
    for (let i = 0; i < DEFAULT_SUBREDDITS.length; i += batchSize) {
      const batch = DEFAULT_SUBREDDITS.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map((sub: string) => scrapeSubreddit(sub, 8))
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
        await new Promise(resolve => setTimeout(resolve, 1500));
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
          subredditsScraped: Object.keys(subredditStats).length,
          usersUpdated: 0 // We don't need to report this
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
