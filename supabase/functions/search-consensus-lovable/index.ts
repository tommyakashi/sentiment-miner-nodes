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
    const { query, filters } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Searching Consensus with Lovable AI for query:', query);

    const systemPrompt = `You are a research paper search assistant with access to Consensus.app, a database of 200M+ academic papers.

Search for academic papers matching the user's query and return structured results.

For each paper found, extract:
- title (string): Full paper title
- authors (array of strings): Author names
- year (number): Publication year
- abstract (string): Paper abstract/summary
- journal (string): Journal or venue name
- citations (number): Citation count if available
- url (string): Link to paper if available
- doi (string): DOI if available
- studyType (string): One of: Meta-Analysis, Systematic Review, RCT, Observational, Case Study, Literature Review, Other
- domain (string): One of: Computer Science, Psychology, Medicine, Biology, Economics, Education, Engineering, Other
- relevanceScore (number): 0-100 score for query relevance

Return ONLY a JSON array of papers, no other text. Example:
[
  {
    "title": "The Impact of AI on Research",
    "authors": ["Smith, J.", "Doe, A."],
    "year": 2023,
    "abstract": "This study examines...",
    "journal": "Nature",
    "citations": 45,
    "url": "https://...",
    "doi": "10.1234/...",
    "studyType": "Literature Review",
    "domain": "Computer Science",
    "relevanceScore": 95
  }
]`;

    const userPrompt = filters 
      ? `Search query: "${query}"\n\nFilters:\n- Year range: ${filters.yearMin}-${filters.yearMax}\n- Study types: ${filters.studyTypes.join(', ') || 'any'}\n- Domains: ${filters.domains.join(', ') || 'any'}\n\nFind 20-30 highly relevant papers.`
      : `Search query: "${query}"\n\nFind 20-30 highly relevant papers.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      throw new Error(`Lovable AI request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON from response
    let papers = [];
    try {
      // Extract JSON array from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      papers = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', content);
      throw new Error('Failed to parse AI response');
    }

    // Add source tag
    const papersWithSource = papers.map((p: any) => ({
      ...p,
      source: 'lovable-ai',
      id: `lovable-${p.doi || p.title.substring(0, 30).replace(/\s+/g, '-')}`,
    }));

    console.log(`Found ${papersWithSource.length} papers via Lovable AI`);

    return new Response(JSON.stringify({ papers: papersWithSource }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in search-consensus-lovable:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
