import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

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

    // Convert to old.reddit.com for better accessibility
    let targetUrl = url.replace('www.reddit.com', 'old.reddit.com');
    
    // Try JSON endpoint first (old.reddit.com is more permissive)
    const jsonUrl = targetUrl.endsWith('.json') ? targetUrl : `${targetUrl}.json`;
    
    console.log(`Attempting JSON fetch from: ${jsonUrl}`);
    
    const response = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RedditScraper/1.0)',
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      // JSON approach worked
      const data = await response.json();
      console.log('Successfully fetched Reddit JSON data');

      let texts: string[] = [];

      // Handle different Reddit data structures
      if (Array.isArray(data)) {
        // Post with comments structure [post, comments]
        const postData = data[0]?.data?.children?.[0]?.data;
        if (postData) {
          texts.push(`${postData.title}\n\n${postData.selftext || ''}`);
        }

        // Extract comments from second array
        const commentsData = data[1]?.data?.children || [];
        for (const comment of commentsData) {
          if (comment.kind === 't1' && comment.data?.body) {
            texts.push(comment.data.body);
          }
        }
      } else if (data?.data?.children) {
        // Subreddit or user posts listing
        for (const child of data.data.children) {
          if (child.kind === 't3' && child.data) {
            texts.push(`${child.data.title}\n\n${child.data.selftext || ''}`);
          } else if (child.kind === 't1' && child.data) {
            texts.push(child.data.body);
          }
        }
      }

      texts = texts.filter(text => text.trim().length > 0);
      
      if (texts.length > 0) {
        console.log(`Extracted ${texts.length} items from JSON`);
        return new Response(
          JSON.stringify({ 
            success: true,
            texts,
            itemCount: texts.length,
            source: 'reddit'
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // JSON failed, try HTML scraping as fallback
    console.log('JSON failed, trying HTML scraping...');
    
    const htmlResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RedditScraper/1.0)',
        'Accept': 'text/html',
      },
    });

    if (!htmlResponse.ok) {
      throw new Error(`Reddit returned ${htmlResponse.status}: ${htmlResponse.statusText}`);
    }

    const html = await htmlResponse.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    if (!doc) {
      throw new Error('Failed to parse HTML');
    }

    const texts: string[] = [];

    // Extract post title and content from old.reddit.com HTML
    const titleElement = doc.querySelector('.title h1') || doc.querySelector('h1');
    if (titleElement) {
      texts.push(titleElement.textContent.trim());
    }

    // Extract post body
    const postBody = doc.querySelector('.usertext-body');
    if (postBody) {
      texts.push(postBody.textContent.trim());
    }

    // Extract comments
    const comments = doc.querySelectorAll('.usertext-body');
    comments.forEach((comment) => {
      const text = comment.textContent.trim();
      if (text.length > 20) {
        texts.push(text);
      }
    });

    const filteredTexts = [...new Set(texts)].filter(text => text.length > 0);

    console.log(`Extracted ${filteredTexts.length} items from HTML`);

    if (filteredTexts.length === 0) {
      throw new Error('No content found. The URL might be invalid or the page structure has changed.');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        texts: filteredTexts,
        itemCount: filteredTexts.length,
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
