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
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('Searching Consensus with OpenAI for query:', query);

    const systemPrompt = `You are a research paper search assistant with access to Consensus.app, a database of 200M+ academic papers.

CRITICAL INSTRUCTION: You MUST return ONLY a valid JSON array. Never return explanatory text, apologies, or suggestions.

Search for academic papers matching the user's query. If the query is vague or contains sentiment words, interpret it as best you can and find relevant papers about the underlying research topics.

For each paper found, extract:
- title (string): Full paper title
- authors (array of strings): Author names
- year (number): Publication year
- abstract (string): Paper abstract/summary
- journal (string): Journal or venue name
- citations (number): Citation count if available, or 0
- url (string): Link to paper if available, or empty string
- doi (string): DOI if available, or empty string
- studyType (string): One of: Meta-Analysis, Systematic Review, RCT, Observational, Case Study, Literature Review, Other
- domain (string): One of: Computer Science, Psychology, Medicine, Biology, Economics, Education, Engineering, Other
- relevanceScore (number): 0-100 score for query relevance

REQUIRED FORMAT - Return ONLY this, no other text:
[
  {
    "title": "Paper Title",
    "authors": ["Author A", "Author B"],
    "year": 2023,
    "abstract": "Abstract text...",
    "journal": "Journal Name",
    "citations": 45,
    "url": "https://...",
    "doi": "10.1234/...",
    "studyType": "Literature Review",
    "domain": "Computer Science",
    "relevanceScore": 95
  }
]

If you cannot find papers, return an empty array: []
NEVER return explanatory text. ONLY return the JSON array.`;

    const userPrompt = filters 
      ? `Search query: "${query}"\n\nFilters:\n- Year range: ${filters.yearMin}-${filters.yearMax}\n- Study types: ${filters.studyTypes.join(', ') || 'any'}\n- Domains: ${filters.domains.join(', ') || 'any'}\n\nFind 20-30 highly relevant papers.`
      : `Search query: "${query}"\n\nFind 20-30 highly relevant papers.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI error:', response.status, errorText);
      throw new Error(`OpenAI request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON from response
    let papers = [];
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      papers = JSON.parse(jsonStr);
      
      if (!Array.isArray(papers)) {
        console.error('AI response is not an array:', papers);
        papers = [];
      }
    } catch (e) {
      console.error('Failed to parse AI response as JSON. Raw content:', content.substring(0, 500));
      
      if (content.includes('cannot fulfill') || content.includes('sorry') || content.includes('rephrase')) {
        console.log('AI refused to search - returning empty results');
        papers = [];
      } else {
        throw new Error('Failed to parse AI response - AI did not return valid JSON');
      }
    }

    // Add source tag
    const papersWithSource = papers.map((p: any) => ({
      ...p,
      source: 'openai',
      id: `openai-${p.doi || p.title.substring(0, 30).replace(/\s+/g, '-')}`,
    }));

    console.log(`Found ${papersWithSource.length} papers via OpenAI`);

    return new Response(JSON.stringify({ papers: papersWithSource }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in search-consensus-openai:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
