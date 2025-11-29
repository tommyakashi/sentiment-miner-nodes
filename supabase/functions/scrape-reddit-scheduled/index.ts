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
      console.error('[Scheduled] Error parsing RSS entry:', e);
    }
  }
  
  return posts;
}

// Scrape via Reddit RSS feeds
async function scrapeViaRSS(
  subreddit: string
): Promise<{ posts: RedditPost[]; comments: RedditComment[] }> {
  const posts: RedditPost[] = [];
  const comments: RedditComment[] = [];
  const scrapedAt = new Date().toISOString();

  try {
    const rssUrl = `https://www.reddit.com/r/${subreddit}/new/.rss`;
    console.log(`[Scheduled][RSS] Fetching: ${rssUrl}`);

    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    });

    if (!response.ok) {
      console.error(`[Scheduled][RSS] Failed to fetch r/${subreddit}: ${response.status}`);
      return { posts, comments };
    }

    const xmlText = await response.text();
    const parsedPosts = parseRSSXML(xmlText, subreddit, scrapedAt);
    posts.push(...parsedPosts);

    console.log(`[Scheduled][RSS] r/${subreddit}: ${posts.length} posts`);
    return { posts, comments };

  } catch (error) {
    console.error(`[Scheduled][RSS] Error scraping r/${subreddit}:`, error);
    return { posts, comments };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[Scheduled] Starting daily Reddit scrape job via RSS feeds...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const allPosts: RedditPost[] = [];
    const allComments: RedditComment[] = [];
    const subredditStats: Record<string, { posts: number; comments: number }> = {};

    // Process in batches of 2 (smaller for RSS to avoid rate limiting)
    const batchSize = 2;
    for (let i = 0; i < DEFAULT_SUBREDDITS.length; i += batchSize) {
      const batch = DEFAULT_SUBREDDITS.slice(i, i + batchSize);
      
      console.log(`[Scheduled] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(DEFAULT_SUBREDDITS.length/batchSize)}`);
      
      const batchResults = await Promise.all(
        batch.map((sub: string) => scrapeViaRSS(sub))
      );

      for (let j = 0; j < batch.length; j++) {
        const subreddit = batch[j];
        const { posts, comments } = batchResults[j];
        
        allPosts.push(...posts);
        allComments.push(...comments);
        subredditStats[subreddit] = { posts: posts.length, comments: comments.length };
      }

      // Longer delay between batches for RSS
      if (i + batchSize < DEFAULT_SUBREDDITS.length) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    // Filter to last 24 hours
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const filteredPosts = allPosts.filter(p => new Date(p.createdAt).getTime() >= oneDayAgo);

    console.log(`[Scheduled] Total scraped: ${filteredPosts.length} posts (filtered from ${allPosts.length})`);

    const allData = [...filteredPosts, ...allComments];

    if (allData.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('data_sources')
        .select('user_id')
        .limit(100);

      const uniqueUserIds = [...new Set((users || []).map(u => u.user_id))];
      
      console.log(`[Scheduled] Saving to ${uniqueUserIds.length} users`);

      for (const userId of uniqueUserIds) {
        const { error: insertError } = await supabase
          .from('data_sources')
          .insert({
            user_id: userId,
            name: `Reddit Scheduled - Daily (${new Date().toLocaleDateString()})`,
            source_type: 'reddit_scheduled',
            url: null,
            content: {
              posts: filteredPosts,
              comments: allComments,
              subredditStats,
              timeRange: 'day',
              dataSource: 'rss',
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
          totalPosts: filteredPosts.length,
          totalComments: allComments.length,
          subredditsScraped: Object.keys(subredditStats).filter(k => subredditStats[k].posts > 0 || subredditStats[k].comments > 0).length,
          dataSource: 'rss'
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
