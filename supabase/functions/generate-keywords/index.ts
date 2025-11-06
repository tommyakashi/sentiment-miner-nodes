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
    const { nodeName, existingKeywords = [] } = await req.json();
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    
    if (!PERPLEXITY_API_KEY) {
      throw new Error("PERPLEXITY_API_KEY is not configured");
    }

    const prompt = `Search for recent research papers and academic literature about "${nodeName}". 
Extract 8-12 specific keywords or technical terms that frequently appear in these research papers.

Keywords should be:
- Actual terms used in academic/research papers about this topic
- Single words or short technical phrases (2-4 words max)
- Relevant for sentiment analysis research
- Diverse, covering different aspects
- Lowercase
${existingKeywords.length > 0 ? `- Different from these existing keywords: ${existingKeywords.join(', ')}` : ''}

Return ONLY a JSON array of keyword strings, nothing else. Example: ["keyword1", "keyword2", ...]`;

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your Perplexity API account." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to generate keywords");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content received from AI");
    }

    // Parse the JSON array from the response
    let keywords: string[];
    try {
      // Try to extract JSON array from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        keywords = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: split by newlines and clean up
        keywords = content
          .split('\n')
          .map((line: string) => line.trim().replace(/^[-*"'\s]+|["'\s]+$/g, ''))
          .filter((line: string) => line.length > 0 && line.length < 50);
      }
    } catch (parseError) {
      console.error("Failed to parse keywords:", parseError);
      // Fallback to splitting by common delimiters
      keywords = content
        .split(/[,\n]/)
        .map((k: string) => k.trim().replace(/^[-*"'\s]+|["'\s]+$/g, ''))
        .filter((k: string) => k.length > 0 && k.length < 50);
    }

    // Filter out any keywords that already exist
    const newKeywords = keywords.filter(
      (k) => !existingKeywords.includes(k.toLowerCase())
    );

    return new Response(
      JSON.stringify({ keywords: newKeywords.slice(0, 10) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-keywords function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
