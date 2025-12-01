import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SEMANTIC_SCHOLAR_API = 'https://api.semanticscholar.org/graph/v1';
const ARXIV_API = 'https://export.arxiv.org/api/query';
const FIELDS = 'paperId,title,abstract,authors,year,citationCount,venue,publicationDate,tldr,fieldsOfStudy,url,influentialCitationCount';
const RATE_LIMIT_DELAY = 1000;

// HARDCODED: All searches must be AI-focused
const AI_SEARCH_PREFIX = 'artificial intelligence';
const AI_FIELDS_OF_STUDY = ['Computer Science', 'Artificial Intelligence', 'Machine Learning'];
const MIN_CITATION_THRESHOLD = 5;

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

// Semantic Scholar search
async function searchSemanticScholar(query: string, yearRange?: string, limit: number = 50) {
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
  console.log(`[Semantic Scholar] Searching: ${url}`);
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    if (response.status === 429) {
      console.log('[Semantic Scholar] Rate limited, waiting...');
      await delay(5000);
      return searchSemanticScholar(query, yearRange, limit);
    }
    throw new Error(`Semantic Scholar API error: ${response.status}`);
  }

  const data = await response.json();
  return (data.data || []).map((p: any) => ({ ...p, source: 'semantic_scholar' }));
}

// arXiv search
async function searchArxiv(query: string, startDate?: string, endDate?: string, limit: number = 50) {
  const aiQuery = `all:("artificial intelligence" OR "machine learning" OR "deep learning" OR "neural network") AND all:${query}`;
  
  const params = new URLSearchParams({
    search_query: aiQuery,
    start: '0',
    max_results: limit.toString(),
    sortBy: 'relevance',
    sortOrder: 'descending',
  });

  const url = `${ARXIV_API}?${params}`;
  console.log(`[arXiv] Searching: ${url}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`[arXiv] API error: ${response.status}`);
    return [];
  }

  const xmlText = await response.text();
  return parseArxivResponse(xmlText, startDate, endDate);
}

function parseArxivResponse(xml: string, startDate?: string, endDate?: string): any[] {
  const papers: any[] = [];
  
  // Parse entries from XML
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    
    const getId = (text: string) => {
      const m = text.match(/<id>([^<]+)<\/id>/);
      return m ? m[1].replace('http://arxiv.org/abs/', '') : '';
    };
    
    const getTitle = (text: string) => {
      const m = text.match(/<title>([^<]+)<\/title>/);
      return m ? m[1].replace(/\s+/g, ' ').trim() : '';
    };
    
    const getAbstract = (text: string) => {
      const m = text.match(/<summary>([^]*?)<\/summary>/);
      return m ? m[1].replace(/\s+/g, ' ').trim() : '';
    };
    
    const getAuthors = (text: string) => {
      const authors: { authorId: string; name: string }[] = [];
      const authorRegex = /<author>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<\/author>/g;
      let authorMatch;
      while ((authorMatch = authorRegex.exec(text)) !== null) {
        authors.push({ authorId: '', name: authorMatch[1].trim() });
      }
      return authors;
    };
    
    const getPublished = (text: string) => {
      const m = text.match(/<published>([^<]+)<\/published>/);
      return m ? m[1].split('T')[0] : '';
    };
    
    const getCategories = (text: string) => {
      const cats: string[] = [];
      const catRegex = /<category[^>]*term="([^"]+)"/g;
      let catMatch;
      while ((catMatch = catRegex.exec(text)) !== null) {
        cats.push(catMatch[1]);
      }
      return cats;
    };

    const id = getId(entry);
    const published = getPublished(entry);
    
    // Filter by date if specified
    if (startDate && published < startDate) continue;
    if (endDate && published > endDate) continue;
    
    papers.push({
      paperId: `arxiv:${id}`,
      title: getTitle(entry),
      abstract: getAbstract(entry),
      authors: getAuthors(entry),
      year: published ? parseInt(published.split('-')[0]) : new Date().getFullYear(),
      publicationDate: published,
      url: `https://arxiv.org/abs/${id}`,
      venue: 'arXiv',
      citationCount: 0, // arXiv doesn't provide citation counts
      influentialCitationCount: 0,
      fieldsOfStudy: getCategories(entry),
      source: 'arxiv',
    });
  }
  
  return papers;
}

async function searchByAuthor(authorName: string, limit: number = 50) {
  const authorSearchUrl = `${SEMANTIC_SCHOLAR_API}/author/search?query=${encodeURIComponent(authorName)}&limit=1`;
  console.log(`[Semantic Scholar] Searching author: ${authorSearchUrl}`);
  
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
  return (papersData.data || []).map((p: any) => ({ ...(p.paper || p), source: 'semantic_scholar' }));
}

function isAIRelatedPaper(paper: any): boolean {
  const fieldsOfStudy = paper.fieldsOfStudy || [];
  const title = (paper.title || '').toLowerCase();
  const abstract = (paper.abstract || '').toLowerCase();
  
  const hasAIField = fieldsOfStudy.some((field: string) => {
    const f = field.toLowerCase();
    return AI_FIELDS_OF_STUDY.some(aiField => f.includes(aiField.toLowerCase())) ||
      f.includes('cs.ai') || f.includes('cs.lg') || f.includes('cs.cl') || f.includes('cs.cv');
  });
  
  const aiKeywords = [
    'artificial intelligence', 'machine learning', 'deep learning', 
    'neural network', 'nlp', 'natural language', 'computer vision',
    'reinforcement learning', 'transformer', 'large language model',
    'llm', 'gpt', 'ai model', 'ai system', 'ai research',
    'generative ai', 'foundation model', 'ai ethics', 'ai safety',
    'ai alignment', 'language model', 'diffusion model', 'chatgpt',
    'attention mechanism', 'bert', 'training data'
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
  
  const citationsPerYear = age > 0 ? citations / age : citations;
  const influentialWeight = influentialCitations * 3;
  const recencyBoost = age <= 1 ? 100 : age <= 2 ? 50 : 0;
  
  // arXiv papers without citations get a boost for being recent preprints
  const arxivBoost = paper.source === 'arxiv' && citations === 0 ? 30 : 0;
  
  return citationsPerYear + influentialWeight + recencyBoost + arxivBoost + Math.log1p(citations) * 10;
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
    source: paper.source || 'semantic_scholar',
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

    // Search by keywords with both Semantic Scholar and arXiv
    if (keywords.length > 0) {
      const limitPerKeyword = Math.ceil((limit * 2) / Math.min(keywords.length, 10));
      
      for (const keyword of keywords.slice(0, 10)) {
        console.log(`Searching AI + topic: "${keyword}"`);
        
        // Semantic Scholar search
        try {
          const ssPapers = await searchSemanticScholar(keyword, yearRange, limitPerKeyword);
          for (const paper of ssPapers) {
            if (paper.paperId && !seenIds.has(paper.paperId) && paper.abstract) {
              if (isAIRelatedPaper(paper) && (paper.citationCount || 0) >= MIN_CITATION_THRESHOLD) {
                seenIds.add(paper.paperId);
                allPapers.push(transformPaper(paper));
              }
            }
          }
          await delay(RATE_LIMIT_DELAY);
        } catch (err) {
          console.error(`[Semantic Scholar] Error searching "${keyword}":`, err);
        }
        
        // arXiv search (no citation threshold for recent preprints)
        try {
          const arxivPapers = await searchArxiv(keyword, startDate, endDate, Math.floor(limitPerKeyword / 2));
          for (const paper of arxivPapers) {
            if (paper.paperId && !seenIds.has(paper.paperId) && paper.abstract) {
              if (isAIRelatedPaper(paper)) {
                seenIds.add(paper.paperId);
                allPapers.push(transformPaper(paper));
              }
            }
          }
          await delay(500); // Smaller delay for arXiv
        } catch (err) {
          console.error(`[arXiv] Error searching "${keyword}":`, err);
        }
      }
    }

    // Search by author
    if (authorQuery) {
      console.log(`Searching author: ${authorQuery}`);
      try {
        const papers = await searchByAuthor(authorQuery, limit);
        for (const paper of papers) {
          if (paper.paperId && !seenIds.has(paper.paperId) && paper.abstract) {
            if (isAIRelatedPaper(paper)) {
              seenIds.add(paper.paperId);
              allPapers.push(transformPaper(paper));
            }
          }
        }
      } catch (err) {
        console.error(`Error searching author "${authorQuery}":`, err);
      }
    }

    // Filter by date range
    let filteredPapers = filterByDateRange(allPapers, startDate, endDate);

    // Sort by importance score
    filteredPapers.sort((a, b) => b.importanceScore - a.importanceScore);

    // Limit results
    const finalPapers = filteredPapers.slice(0, limit);

    // Count sources
    const semanticScholarCount = finalPapers.filter(p => p.source === 'semantic_scholar').length;
    const arxivCount = finalPapers.filter(p => p.source === 'arxiv').length;

    console.log(`Found ${finalPapers.length} high-impact AI papers (SS: ${semanticScholarCount}, arXiv: ${arxivCount})`);

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
          semanticScholarCount,
          arxivCount,
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
