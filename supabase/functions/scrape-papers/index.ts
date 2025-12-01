import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SEMANTIC_SCHOLAR_API = 'https://api.semanticscholar.org/graph/v1';
const FIELDS = 'paperId,title,abstract,authors,year,citationCount,venue,publicationDate,tldr,fieldsOfStudy,url';
const RATE_LIMIT_DELAY = 1000; // 1 second between requests to respect rate limits

interface SearchParams {
  keywords?: string[];
  authorQuery?: string;
  yearMin?: number;
  yearMax?: number;
  domains?: string[];
  limit?: number;
  saveToDb?: boolean;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchPapers(query: string, yearRange?: string, limit: number = 50) {
  const params = new URLSearchParams({
    query,
    fields: FIELDS,
    limit: limit.toString(),
  });
  
  if (yearRange) {
    params.append('year', yearRange);
  }

  const url = `${SEMANTIC_SCHOLAR_API}/paper/search?${params}`;
  console.log(`Searching papers: ${url}`);
  
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
  // First search for the author
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

  // Get author's papers
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
    fieldsOfStudy: paper.fieldsOfStudy || [],
    publicationDate: paper.publicationDate || '',
    url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
    combinedText: `${paper.title || ''} ${abstract} ${tldr}`.trim(),
    createdAt: new Date().toISOString(),
    dataType: 'paper',
  };
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
    const { keywords = [], authorQuery, yearMin, yearMax, domains, limit = 100, saveToDb = true } = body;

    console.log(`Scraping papers - Keywords: ${keywords.join(', ')}, Author: ${authorQuery}, Years: ${yearMin}-${yearMax}`);

    const allPapers: any[] = [];
    const seenIds = new Set<string>();

    // Build year range string
    const yearRange = yearMin && yearMax ? `${yearMin}-${yearMax}` : undefined;

    // Search by keywords
    if (keywords.length > 0) {
      for (const keyword of keywords) {
        console.log(`Searching keyword: ${keyword}`);
        try {
          const papers = await searchPapers(keyword, yearRange, Math.ceil(limit / keywords.length));
          for (const paper of papers) {
            if (paper.paperId && !seenIds.has(paper.paperId) && paper.abstract) {
              seenIds.add(paper.paperId);
              allPapers.push(transformPaper(paper));
            }
          }
          await delay(RATE_LIMIT_DELAY);
        } catch (err) {
          console.error(`Error searching keyword "${keyword}":`, err);
        }
      }
    }

    // Search by author
    if (authorQuery) {
      console.log(`Searching author: ${authorQuery}`);
      try {
        const papers = await searchByAuthor(authorQuery, limit);
        for (const paper of papers) {
          const actualPaper = paper.paper || paper;
          if (actualPaper.paperId && !seenIds.has(actualPaper.paperId) && actualPaper.abstract) {
            seenIds.add(actualPaper.paperId);
            allPapers.push(transformPaper(actualPaper));
          }
        }
      } catch (err) {
        console.error(`Error searching author "${authorQuery}":`, err);
      }
    }

    // Filter by domains if specified
    let filteredPapers = allPapers;
    if (domains && domains.length > 0) {
      filteredPapers = allPapers.filter(paper => {
        const paperFields = paper.fieldsOfStudy || [];
        return domains.some(domain => 
          paperFields.some((field: string) => 
            field.toLowerCase().includes(domain.toLowerCase())
          )
        );
      });
    }

    // Filter by year range (additional filter for author search results)
    if (yearMin || yearMax) {
      filteredPapers = filteredPapers.filter(paper => {
        const year = paper.year;
        if (yearMin && year < yearMin) return false;
        if (yearMax && year > yearMax) return false;
        return true;
      });
    }

    // Limit results
    const finalPapers = filteredPapers.slice(0, limit);

    console.log(`Found ${finalPapers.length} papers (${allPapers.length} before filtering)`);

    // Save to database
    if (saveToDb && finalPapers.length > 0) {
      const { error: saveError } = await supabase
        .from('paper_scrapes')
        .insert({
          user_id: user.id,
          keywords,
          author_query: authorQuery,
          year_min: yearMin,
          year_max: yearMax,
          domains,
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
          yearRange: yearRange || 'All years',
          domains: domains || [],
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
