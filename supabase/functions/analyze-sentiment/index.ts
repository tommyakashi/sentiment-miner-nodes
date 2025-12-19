import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Node {
  id: string;
  name: string;
  keywords: string[];
}

interface SentimentResult {
  text: string;
  nodeId: string;
  nodeName: string;
  polarity: 'positive' | 'neutral' | 'negative';
  polarityScore: number;
  kpiScores: {
    trust: number;
    optimism: number;
    frustration: number;
    clarity: number;
    access: number;
    fairness: number;
  };
  confidence: number;
}

interface AnalysisItem {
  polarity: 'positive' | 'neutral' | 'negative';
  score: number;
  node: string;
  confidence: number;
  kpi: [number, number, number, number, number, number];
}

// SPEED OPTIMIZED: Large batches + high parallelism + fastest model
const BATCH_SIZE = 100;
const PARALLEL_BATCHES = 8;
const MAX_TEXT_LENGTH = 100;

// Robust JSON parser with repair attempts
function parseJsonSafely(content: string, expectedCount: number): AnalysisItem[] {
  let jsonStr = content.trim();
  
  // Extract from markdown code blocks
  if (jsonStr.includes('```')) {
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match?.[1]) jsonStr = match[1].trim();
  }
  
  // Find JSON array
  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (arrayMatch) jsonStr = arrayMatch[0];
  
  // Try direct parse first
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    // Continue to repair attempts
  }
  
  // Repair attempt 1: Fix trailing commas and missing commas
  try {
    let repaired = jsonStr
      .replace(/,\s*]/g, ']')           // trailing commas before ]
      .replace(/,\s*}/g, '}')           // trailing commas before }
      .replace(/}\s*{/g, '},{')         // missing commas between objects
      .replace(/]\s*\[/g, '],[')        // missing commas between arrays
      .replace(/"\s*"/g, '","')         // missing commas between strings
      .replace(/(\d)\s*"/g, '$1,"')     // missing comma after number before string
      .replace(/"\s*(\d)/g, '",$1');    // missing comma after string before number
    
    const parsed = JSON.parse(repaired);
    if (Array.isArray(parsed)) {
      console.log(`[analyze-sentiment] JSON repaired successfully`);
      return parsed;
    }
  } catch (e) {
    // Continue to next repair
  }
  
  // Repair attempt 2: Extract individual objects
  try {
    const objectMatches = jsonStr.matchAll(/\{[^{}]*\}/g);
    const objects: AnalysisItem[] = [];
    for (const match of objectMatches) {
      try {
        const obj = JSON.parse(match[0]);
        if (obj && (obj.polarity || obj.score !== undefined || obj.node)) {
          objects.push(obj);
        }
      } catch (e) {
        // Skip malformed objects
      }
    }
    if (objects.length > 0) {
      console.log(`[analyze-sentiment] Extracted ${objects.length} objects from malformed JSON`);
      return objects;
    }
  } catch (e) {
    // Fall through to return empty
  }
  
  return [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const requestText = await req.text();
    if (!requestText) {
      return new Response(JSON.stringify({ error: 'Empty request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let texts: string[];
    let nodes: Node[];
    
    try {
      const body = JSON.parse(requestText);
      texts = body.texts;
      nodes = body.nodes;
    } catch (parseErr) {
      console.error('[analyze-sentiment] Failed to parse request body:', parseErr);
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return new Response(JSON.stringify({ error: 'No texts provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return new Response(JSON.stringify({ error: 'No nodes provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[analyze-sentiment] Starting: ${texts.length} texts, ${nodes.length} nodes`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Node reference for prompt
    const nodeIds = nodes.map(n => n.id).join(',');
    
    // Clearer prompt format that model handles better
    const systemPrompt = `Analyze sentiment for each text. Return ONLY a valid JSON array, no explanation.
Each item: {"polarity":"positive"|"neutral"|"negative","score":-1to1,"node":"nodeId","confidence":0to1,"kpi":[trust,optimism,frustration,clarity,access,fairness]}
Available nodes: [${nodeIds}]. kpi values range -1 to 1. Return one object per text in order.`;

    const totalBatches = Math.ceil(texts.length / BATCH_SIZE);

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        const sendEvent = (eventType: string, data: any) => {
          const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        sendEvent('progress', { type: 'start', totalTexts: texts.length, totalBatches });

        const allResults: SentimentResult[] = [];

        // Process a single batch - NO TOOL CALLING for speed
        async function processBatch(batchIndex: number, batchTexts: string[]): Promise<SentimentResult[]> {
          // Truncate texts aggressively for speed
          const textsForPrompt = batchTexts.map((t, i) => `${i}:"${t.slice(0, MAX_TEXT_LENGTH)}"`).join('\n');
          
          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite", // FASTEST model
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: textsForPrompt }
              ],
              max_tokens: 6000, // Reduced for speed
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[analyze-sentiment] Batch ${batchIndex + 1} error: ${response.status}`);
            
            if (response.status === 429) throw new Error('rate_limit');
            if (response.status === 402) throw new Error('credits_exhausted');
            throw new Error(`AI request failed: ${response.status}`);
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || '';
          
          // Parse with robust repair logic
          const parsed = parseJsonSafely(content, batchTexts.length);
          console.log(`[analyze-sentiment] Batch ${batchIndex + 1}: ${parsed.length}/${batchTexts.length} parsed`);

          // Map results to full format with fallbacks
          const defaultKpi = { trust: 0, optimism: 0, frustration: 0, clarity: 0, access: 0, fairness: 0 };
          const batchResults: SentimentResult[] = [];
          
          for (let i = 0; i < batchTexts.length; i++) {
            const r = parsed[i];
            
            if (r && (r.polarity || r.score !== undefined)) {
              const matchedNode = nodes.find(n => n.id === r.node) || nodes[0];
              
              batchResults.push({
                text: batchTexts[i],
                nodeId: matchedNode.id,
                nodeName: matchedNode.name,
                polarity: ['positive', 'neutral', 'negative'].includes(r.polarity) ? r.polarity : 'neutral',
                polarityScore: typeof r.score === 'number' ? r.score : 0,
                kpiScores: Array.isArray(r.kpi) ? {
                  trust: r.kpi[0] ?? 0,
                  optimism: r.kpi[1] ?? 0,
                  frustration: r.kpi[2] ?? 0,
                  clarity: r.kpi[3] ?? 0,
                  access: r.kpi[4] ?? 0,
                  fairness: r.kpi[5] ?? 0,
                } : defaultKpi,
                confidence: typeof r.confidence === 'number' ? Math.min(0.95, r.confidence) : 0.5,
              });
            } else {
              // ALWAYS return a fallback result - never skip
              batchResults.push({
                text: batchTexts[i],
                nodeId: nodes[0].id,
                nodeName: nodes[0].name,
                polarity: 'neutral',
                polarityScore: 0,
                kpiScores: defaultKpi,
                confidence: 0.2, // Low confidence for fallback
              });
            }
          }

          return batchResults;
        }

        // Wrapper with retry
        async function processBatchWithRetry(batchIndex: number, batchTexts: string[]): Promise<SentimentResult[]> {
          try {
            return await processBatch(batchIndex, batchTexts);
          } catch (error) {
            if (error instanceof Error && (error.message === 'rate_limit' || error.message === 'credits_exhausted')) {
              throw error;
            }
            console.log(`[analyze-sentiment] Retry batch ${batchIndex + 1}`);
            return await processBatch(batchIndex, batchTexts);
          }
        }

        // Process batches in parallel groups
        let rateLimited = false;
        let creditsExhausted = false;

        for (let groupStart = 0; groupStart < totalBatches && !rateLimited && !creditsExhausted; groupStart += PARALLEL_BATCHES) {
          const groupEnd = Math.min(groupStart + PARALLEL_BATCHES, totalBatches);
          const batchPromises: Promise<{ batchIndex: number; results: SentimentResult[] }>[] = [];

          for (let batchIndex = groupStart; batchIndex < groupEnd; batchIndex++) {
            const startIdx = batchIndex * BATCH_SIZE;
            const batchTexts = texts.slice(startIdx, startIdx + BATCH_SIZE);
            
            sendEvent('progress', { type: 'batch_start', batch: batchIndex + 1, totalBatches });

            batchPromises.push(
              processBatchWithRetry(batchIndex, batchTexts)
                .then(results => ({ batchIndex, results }))
                .catch(error => {
                  if (error.message === 'rate_limit') {
                    rateLimited = true;
                    sendEvent('error', { type: 'rate_limit', message: 'Rate limited' });
                  } else if (error.message === 'credits_exhausted') {
                    creditsExhausted = true;
                    sendEvent('error', { type: 'credits_exhausted', message: 'Credits exhausted' });
                  }
                  return { batchIndex, results: [] };
                })
            );
          }

          const batchResultsArray = await Promise.all(batchPromises);

          for (const { batchIndex, results } of batchResultsArray.sort((a, b) => a.batchIndex - b.batchIndex)) {
            if (results.length > 0) {
              allResults.push(...results);
              sendEvent('batch_complete', { 
                batch: batchIndex + 1, 
                totalBatches,
                results,
                processedCount: allResults.length,
                totalCount: texts.length
              });
            }
          }
        }

        const totalTime = Date.now() - startTime;
        console.log(`[analyze-sentiment] Done: ${allResults.length} in ${totalTime}ms`);

        sendEvent('complete', { 
          results: allResults,
          processedCount: allResults.length,
          totalCount: texts.length,
          executionTimeMs: totalTime
        });

        controller.close();
      }
    });

    return new Response(stream, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      },
    });

  } catch (error) {
    console.error('[analyze-sentiment] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Analysis failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
