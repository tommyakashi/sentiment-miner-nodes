import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SEMANTIC_SCHOLAR_API = 'https://api.semanticscholar.org/graph/v1';
const FIELDS = 'paperId,title,abstract,authors,year,citationCount,venue,publicationDate,tldr,fieldsOfStudy,url,influentialCitationCount';
const RATE_LIMIT_DELAY = 1000;

// HARDCODED: All searches must be AI-focused
const AI_SEARCH_PREFIX = 'artificial intelligence';
const AI_FIELDS_OF_STUDY = ['Computer Science', 'Artificial Intelligence', 'Machine Learning'];
const MIN_CITATION_THRESHOLD = 5; // Minimum citations for relevance

interface SearchParams {
  keywords?: string[];
  authorQuery?: string;
  startDate?: string;
  endDate?: string;
  yearMin?: number;
  yearMax?: number;
  limit?: number;
  saveToDb?: boolean;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchPapers(query: string, yearRange?: string, limit: number = 50) {
  // Prepend AI focus to all queries
  const aiQuery = `${AI_SEARCH_PREFIX} ${query}`;
  
  const params = new URLSearchParams({
    query: aiQuery,
    fields: FIELDS,
    limit: limit.toString(),
  });
  
  if (yearRange) {
    params.append('year', yearRange);
  }

  const url = `${SEMANTIC_SCHOLAR_API}/paper/search?${params}`;
  console.log(`Searching AI papers: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 429) {
      console.log('Rate limited, waiting...');
      await delay(5000);
      return searchPapers(query, yearRange, limit);
    }
    throw new Error(`Semantic Scholar API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data || [];
}

async function searchByAuthor(authorName: string, limit: number = 50) {
  const authorSearchUrl = `${SEMANTIC_SCHOLAR_API}/author/search?query=${encodeURIComponent(authorName)}&limit=1`;
  console.log(`Searching author: ${authorSearchUrl}`);
  
  const authorResponse = await fetch(authorSearchUrl, {
    headers: { 'Accept': 'application/json' },
  });

  if (!authorResponse.ok) {
    console.error(`Author search failed: ${authorResponse.status}`);
    return [];
  }

  const authorData = await authorResponse.json();
  if (!authorData.data || authorData.data.length === 0) {
    console.log(`No author found for: ${authorName}`);
    return [];
  }

  const authorId = authorData.data[0].authorId;
  console.log(`Found author ID: ${authorId}`);

  await delay(RATE_LIMIT_DELAY);

  const papersUrl = `${SEMANTIC_SCHOLAR_API}/author/${authorId}/papers?fields=${FIELDS}&limit=${limit}`;
  const papersResponse = await fetch(papersUrl, {
    headers: { 'Accept': 'application/json' },
  });

  if (!papersResponse.ok) {
    console.error(`Author papers fetch failed: ${papersResponse.status}`);
    return [];
  }

  const papersData = await papersResponse.json();
  return papersData.data || [];
}

function isAIRelatedPaper(paper: any): boolean {
  const fieldsOfStudy = paper.fieldsOfStudy || [];
  const title = (paper.title || '').toLowerCase();
  const abstract = (paper.abstract || '').toLowerCase();
  
  // Check fields of study
  const hasAIField = fieldsOfStudy.some((field: string) => 
    AI_FIELDS_OF_STUDY.some(aiField => 
      field.toLowerCase().includes(aiField.toLowerCase())
    )
  );
  
  // Check for AI keywords in title/abstract
  const aiKeywords = [
    'artificial intelligence', 'machine learning', 'deep learning', 
    'neural network', 'nlp', 'natural language', 'computer vision',
    'reinforcement learning', 'transformer', 'large language model',
    'llm', 'gpt', 'ai model', 'ai system', 'ai research',
    'generative ai', 'foundation model', 'ai ethics', 'ai safety',
    'ai alignment', 'language model', 'diffusion model'
  ];
  
  const hasAIKeyword = aiKeywords.some(keyword => 
    title.includes(keyword) || abstract.includes(keyword)
  );
  
  return hasAIField || hasAIKeyword;
}

function calculateImportanceScore(paper: any): number {
  const citations = paper.citationCount || 0;
  const influentialCitations = paper.influentialCitationCount || 0;
  const year = paper.year || 2020;
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  
  // Normalize citations by age (citations per year)
  const citationsPerYear = age > 0 ? citations / age : citations;
  
  // Weight influential citations more heavily
  const influentialWeight = influentialCitations * 3;
  
  // Recent papers get a boost (published in last 2 years)
  const recencyBoost = age <= 2 ? 50 : 0;
  
  // Calculate composite score
  return citationsPerYear + influentialWeight + recencyBoost + Math.log1p(citations) * 10;
}

function transformPaper(paper: any) {
  const abstract = paper.abstract || '';
  const tldr = paper.tldr?.text || '';
  
  return {
    id: paper.paperId,
    paperId: paper.paperId,
    title: paper.title || 'Untitled',
    abstract,
    tldr,
    authors: (paper.authors || []).map((a: any) => ({
      authorId: a.authorId || '',
      name: a.name || 'Unknown',
    })),
    year: paper.year || 0,
    venue: paper.venue || '',
    citationCount: paper.citationCount || 0,
    influentialCitationCount: paper.influentialCitationCount || 0,
    fieldsOfStudy: paper.fieldsOfStudy || [],
    publicationDate: paper.publicationDate || '',
    url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
    combinedText: `${paper.title || ''} ${abstract} ${tldr}`.trim(),
    createdAt: new Date().toISOString(),
    dataType: 'paper',
    importanceScore: calculateImportanceScore(paper),
  };
}

function filterByDateRange(papers: any[], startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return papers;
  
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  
  return papers.filter(paper => {
    const pubDate = paper.publicationDate;
    
    if (pubDate) {
      const paperDate = new Date(pubDate);
      if (start && paperDate < start) return false;
      if (end && paperDate > end) return false;
      return true;
    }
    
    const year = paper.year;
    if (!year) return true;
    
    const startYear = start ? start.getFullYear() : null;
    const endYear = end ? end.getFullYear() : null;
    
    if (startYear && year < startYear) return false;
    if (endYear && year > endYear) return false;
    
    return true;
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: SearchParams = await req.json();
    const { 
      keywords = [], 
      authorQuery, 
      startDate,
      endDate,
      yearMin, 
      yearMax, 
      limit = 100, 
      saveToDb = true 
    } = body;

    console.log(`Scraping AI papers - Topics: ${keywords.join(', ')}, Author: ${authorQuery}, Date: ${startDate} to ${endDate}`);

    const allPapers: any[] = [];
    const seenIds = new Set<string>();

    let yearRange: string | undefined;
    if (startDate && endDate) {
      const startYear = new Date(startDate).getFullYear();
      const endYear = new Date(endDate).getFullYear();
      yearRange = `${startYear}-${endYear}`;
    } else if (yearMin && yearMax) {
      yearRange = `${yearMin}-${yearMax}`;
    }

    // Search by keywords with AI prefix
    if (keywords.length > 0) {
      const limitPerKeyword = Math.ceil((limit * 2) / Math.min(keywords.length, 10)); // Fetch more to filter
      
      for (const keyword of keywords.slice(0, 10)) {
        console.log(`Searching AI + topic: "${keyword}"`);
        try {
          const papers = await searchPapers(keyword, yearRange, limitPerKeyword);
          for (const paper of papers) {
            if (paper.paperId && !seenIds.has(paper.paperId) && paper.abstract) {
              // Filter for AI-related papers and minimum citations
              if (isAIRelatedPaper(paper) && (paper.citationCount || 0) >= MIN_CITATION_THRESHOLD) {
                seenIds.add(paper.paperId);
                allPapers.push(transformPaper(paper));
              }
            }
          }
          await delay(RATE_LIMIT_DELAY);
        } catch (err) {
          console.error(`Error searching topic "${keyword}":`, err);
        }
      }
    }

    // Search by author (filter AI papers from their work)
    if (authorQuery) {
      console.log(`Searching author: ${authorQuery}`);
      try {
        const papers = await searchByAuthor(authorQuery, limit);
        for (const paper of papers) {
          const actualPaper = paper.paper || paper;
          if (actualPaper.paperId && !seenIds.has(actualPaper.paperId) && actualPaper.abstract) {
            if (isAIRelatedPaper(actualPaper)) {
              seenIds.add(actualPaper.paperId);
              allPapers.push(transformPaper(actualPaper));
            }
          }
        }
      } catch (err) {
        console.error(`Error searching author "${authorQuery}":`, err);
      }
    }

    // Filter by date range
    let filteredPapers = filterByDateRange(allPapers, startDate, endDate);

    // Sort by importance score (citations, influential citations, recency)
    filteredPapers.sort((a, b) => b.importanceScore - a.importanceScore);

    // Limit results
    const finalPapers = filteredPapers.slice(0, limit);

    console.log(`Found ${finalPapers.length} high-impact AI papers (${allPapers.length} before filtering)`);

    // Save to database
    if (saveToDb && finalPapers.length > 0) {
      const { error: saveError } = await supabase
        .from('paper_scrapes')
        .insert({
          user_id: user.id,
          keywords,
          author_query: authorQuery,
          year_min: startDate ? new Date(startDate).getFullYear() : yearMin,
          year_max: endDate ? new Date(endDate).getFullYear() : yearMax,
          total_papers: finalPapers.length,
          papers: finalPapers,
        });

      if (saveError) {
        console.error('Error saving to database:', saveError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: finalPapers,
        summary: {
          totalPapers: finalPapers.length,
          keywords,
          authorQuery,
          dateRange: startDate && endDate ? `${startDate} to ${endDate}` : yearRange || 'All time',
          focus: 'Artificial Intelligence & AI Research',
          sortedBy: 'Importance (citations, influence, recency)',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Scrape papers error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
