import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Calculate Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function similarity(a: string, b: string): number {
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLength = Math.max(a.length, b.length);
  return ((maxLength - distance) / maxLength) * 100;
}

function countMatchingAuthors(authors1: string[], authors2: string[]): number {
  let matches = 0;
  for (const a1 of authors1) {
    for (const a2 of authors2) {
      if (similarity(a1, a2) > 80) {
        matches++;
        break;
      }
    }
  }
  return matches;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { setA, setB } = await req.json();
    
    console.log(`Merging ${setA.length} papers from Lovable AI and ${setB.length} papers from OpenAI`);

    const merged = [];
    const usedIndicesB = new Set();

    // For each paper in setA, try to find a duplicate in setB
    for (const paperA of setA) {
      let foundDuplicate = false;
      
      for (let i = 0; i < setB.length; i++) {
        if (usedIndicesB.has(i)) continue;
        
        const paperB = setB[i];
        
        // Check 1: DOI exact match
        if (paperA.doi && paperB.doi && paperA.doi === paperB.doi) {
          merged.push({
            ...paperA,
            source: 'both',
            abstract: paperA.abstract.length > paperB.abstract.length ? paperA.abstract : paperB.abstract,
            citations: Math.max(paperA.citations || 0, paperB.citations || 0),
            relevanceScore: ((paperA.relevanceScore || 50) + (paperB.relevanceScore || 50)) / 2,
            urls: [paperA.url, paperB.url].filter(Boolean),
          });
          usedIndicesB.add(i);
          foundDuplicate = true;
          break;
        }
        
        // Check 2: Title similarity > 90%
        const titleSim = similarity(paperA.title, paperB.title);
        if (titleSim > 90) {
          merged.push({
            ...paperA,
            source: 'both',
            abstract: paperA.abstract.length > paperB.abstract.length ? paperA.abstract : paperB.abstract,
            citations: Math.max(paperA.citations || 0, paperB.citations || 0),
            relevanceScore: ((paperA.relevanceScore || 50) + (paperB.relevanceScore || 50)) / 2,
            urls: [paperA.url, paperB.url].filter(Boolean),
          });
          usedIndicesB.add(i);
          foundDuplicate = true;
          break;
        }
        
        // Check 3: Author overlap + same year
        const authorMatches = countMatchingAuthors(paperA.authors, paperB.authors);
        if (authorMatches >= 2 && paperA.year === paperB.year) {
          merged.push({
            ...paperA,
            source: 'both',
            abstract: paperA.abstract.length > paperB.abstract.length ? paperA.abstract : paperB.abstract,
            citations: Math.max(paperA.citations || 0, paperB.citations || 0),
            relevanceScore: ((paperA.relevanceScore || 50) + (paperB.relevanceScore || 50)) / 2,
            urls: [paperA.url, paperB.url].filter(Boolean),
          });
          usedIndicesB.add(i);
          foundDuplicate = true;
          break;
        }
      }
      
      if (!foundDuplicate) {
        merged.push(paperA);
      }
    }

    // Add remaining papers from setB that weren't matched
    for (let i = 0; i < setB.length; i++) {
      if (!usedIndicesB.has(i)) {
        merged.push(setB[i]);
      }
    }

    const duplicatesRemoved = (setA.length + setB.length) - merged.length;
    console.log(`Deduplication complete: ${merged.length} unique papers (removed ${duplicatesRemoved} duplicates)`);

    return new Response(
      JSON.stringify({ 
        papers: merged,
        stats: {
          lovableAI: setA.length,
          openAI: setB.length,
          merged: merged.length,
          duplicatesRemoved,
          foundByBoth: merged.filter((p: any) => p.source === 'both').length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in merge-research-results:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
