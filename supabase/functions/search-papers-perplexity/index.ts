import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');

    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY not configured');
    }

    console.log('Searching research papers with Perplexity for query:', query);

    const systemPrompt = `You are a research paper discovery assistant. When given a research question, search the web for relevant academic papers and return structured information.

CRITICAL: You MUST return ONLY a valid JSON array. No explanatory text, no apologies, no suggestions.

For each paper you find, extract:
{
  "title": "Full paper title",
  "authors": ["Author A", "Author B"],
  "year": 2023,
  "abstract": "Paper abstract or summary (at least 100 words)",
  "journal": "Journal or Conference name",
  "citations": 0,
  "url": "Direct link to paper",
  "doi": "DOI if available",
  "studyType": "One of: Meta-Analysis, Systematic Review, RCT, Observational, Case Study, Literature Review, Other",
  "domain": "One of: Computer Science, Psychology, Medicine, Biology, Economics, Education, Engineering, Other",
  "relevanceScore": 95
}

Find 15-25 highly relevant academic papers. Use Google Scholar, arXiv, PubMed, JSTOR, or other academic sources.

REQUIRED FORMAT:
[
  { paper1 },
  { paper2 },
  ...
]

Return ONLY the JSON array. Nothing else.`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.2,
        top_p: 0.9,
        return_images: false,
        return_related_questions: false,
        search_recency_filter: 'year',
        frequency_penalty: 1,
        presence_penalty: 0
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity error:', response.status, errorText);
      throw new Error(`Perplexity API request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log('Perplexity raw response:', content.substring(0, 500));

    // Parse JSON from response
    let papers = [];
    try {
      // Try to extract JSON array from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      papers = JSON.parse(jsonStr);
      
      // Ensure it's an array
      if (!Array.isArray(papers)) {
        console.error('Response is not an array:', papers);
        papers = [];
      }
    } catch (e) {
      console.error('Failed to parse Perplexity response as JSON. Raw:', content);
      
      // If it's not JSON, try to extract any paper information we can find
      // But for now, just return empty array
      papers = [];
    }

    // Add unique IDs and ensure required fields
    const papersWithIds = papers.map((p: any, idx: number) => ({
      id: `perplexity-${Date.now()}-${idx}`,
      title: p.title || 'Untitled',
      authors: Array.isArray(p.authors) ? p.authors : [],
      year: p.year || new Date().getFullYear(),
      abstract: p.abstract || '',
      journal: p.journal || '',
      citations: p.citations || 0,
      url: p.url || '',
      doi: p.doi || '',
      studyType: p.studyType || 'Other',
      domain: p.domain || 'Other',
      relevanceScore: p.relevanceScore || 50,
      source: 'perplexity',
    }));

    console.log(`Found ${papersWithIds.length} papers via Perplexity`);

    return new Response(JSON.stringify({ papers: papersWithIds }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in search-papers-perplexity:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
