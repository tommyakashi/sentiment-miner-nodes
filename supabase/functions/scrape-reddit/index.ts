import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      throw new Error("URL is required");
    }

    console.log(`Scraping Reddit URL: ${url}`);

    // Add small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));

    // Convert Reddit URL to JSON endpoint and add query params
    let jsonUrl = url.endsWith('.json') ? url : `${url}.json`;
    
    // Add query parameters to make request look more legitimate
    const urlObj = new URL(jsonUrl);
    urlObj.searchParams.set('raw_json', '1');
    urlObj.searchParams.set('limit', '100');
    jsonUrl = urlObj.toString();
    
    // Use realistic browser headers with referer
    const response = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.reddit.com/',
        'Origin': 'https://www.reddit.com',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`Reddit API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Successfully fetched Reddit data');

    // Parse Reddit data structure
    let texts: string[] = [];
    let itemCount = 0;

    // Handle different Reddit data structures
    if (Array.isArray(data)) {
      // Post with comments structure [post, comments]
      const postData = data[0]?.data?.children?.[0]?.data;
      if (postData) {
        // Add post title and selftext
        texts.push(`${postData.title}\n\n${postData.selftext || ''}`);
        itemCount++;
      }

      // Extract comments from second array
      const commentsData = data[1]?.data?.children || [];
      for (const comment of commentsData) {
        if (comment.kind === 't1' && comment.data?.body) {
          texts.push(comment.data.body);
          itemCount++;
        }
      }
    } else if (data?.data?.children) {
      // Subreddit or user posts listing
      for (const child of data.data.children) {
        if (child.kind === 't3' && child.data) {
          // It's a post
          const post = child.data;
          texts.push(`${post.title}\n\n${post.selftext || ''}`);
          itemCount++;
        } else if (child.kind === 't1' && child.data) {
          // It's a comment
          texts.push(child.data.body);
          itemCount++;
        }
      }
    }

    // Filter out empty texts
    texts = texts.filter(text => text.trim().length > 0);

    console.log(`Extracted ${texts.length} items from Reddit`);

    return new Response(
      JSON.stringify({ 
        success: true,
        texts,
        itemCount: texts.length,
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
