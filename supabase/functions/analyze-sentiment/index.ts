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

// SPEED OPTIMIZED: Large batches + high parallelism + fastest model
const BATCH_SIZE = 100;
const PARALLEL_BATCHES = 8;
const MAX_TEXT_LENGTH = 120;

// Robust JSON repair function
function repairAndParseJSON(content: string): any[] {
  let jsonStr = content.trim();
  
  // Remove markdown code blocks
  if (jsonStr.includes('```')) {
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match?.[1]) jsonStr = match[1].trim();
  }
  
  // Extract array portion
  const arrayStart = jsonStr.indexOf('[');
  const arrayEnd = jsonStr.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    jsonStr = jsonStr.slice(arrayStart, arrayEnd + 1);
  }
  
  // Try direct parse first
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Attempt repairs
  }
  
  // Fix common issues
  jsonStr = jsonStr
    // Fix unquoted property names
    .replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
    // Fix single quotes to double quotes
    .replace(/'/g, '"')
    // Fix trailing commas before ] or }
    .replace(/,\s*([\]\}])/g, '$1')
    // Fix missing commas between objects
    .replace(/\}\s*\{/g, '},{')
    // Remove any control characters
    .replace(/[\x00-\x1F\x7F]/g, ' ');
  
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Last resort: extract individual objects
  }
  
  // Extract individual JSON objects as fallback
  const results: any[] = [];
  const objectPattern = /\{[^{}]*\}/g;
  let match;
  while ((match = objectPattern.exec(jsonStr)) !== null) {
    try {
      const obj = JSON.parse(match[0]);
      results.push(obj);
    } catch {
      // Skip malformed objects
    }
  }
  
  return results;
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

    // Node mapping for the prompt
    const nodeIds = nodes.map(n => n.id).join('|');
    
    // Clear, explicit prompt that produces reliable JSON
    const systemPrompt = `You are a sentiment analyzer. For each numbered text, output a JSON object on its own line.

Format per text (one JSON object per line, no array wrapper):
{"i":INDEX,"p":"pos"|"neu"|"neg","s":SCORE,"n":"NODE_ID","c":CONF,"t":T,"o":O,"f":F,"cl":CL,"a":A,"fa":FA}

Fields:
- i: text index (0-based)
- p: polarity (pos/neu/neg)
- s: polarity score (-1 to 1)
- n: best matching node from [${nodeIds}]
- c: confidence (0-1)
- t,o,f,cl,a,fa: trust,optimism,frustration,clarity,access,fairness scores (-1 to 1)

Output ONLY the JSON objects, one per line. No other text.`;

    const totalBatches = Math.ceil(texts.length / BATCH_SIZE);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        const sendEvent = (eventType: string, data: any) => {
          const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        sendEvent('progress', { type: 'start', totalTexts: texts.length, totalBatches });

        const allResults: SentimentResult[] = [];

        async function processBatch(batchIndex: number, batchTexts: string[]): Promise<SentimentResult[]> {
          // Format texts with clear indexing
          const textsForPrompt = batchTexts.map((t, i) => {
            // Clean text: remove quotes and newlines that could break JSON
            const clean = t.slice(0, MAX_TEXT_LENGTH).replace(/[\n\r"]/g, ' ').trim();
            return `[${i}] ${clean}`;
          }).join('\n');
          
          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Analyze these ${batchTexts.length} texts:\n${textsForPrompt}` }
              ],
              max_tokens: 8000,
            }),
          });

          if (!response.ok) {
            console.error(`[analyze-sentiment] Batch ${batchIndex + 1} error: ${response.status}`);
            if (response.status === 429) throw new Error('rate_limit');
            if (response.status === 402) throw new Error('credits_exhausted');
            throw new Error(`AI request failed: ${response.status}`);
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || '';
          
          // Parse response - try line-by-line first, then array
          let parsed: any[] = [];
          
          // Method 1: Parse line-by-line JSON objects
          const lines = content.split('\n').filter((l: string) => l.trim().startsWith('{'));
          if (lines.length > 0) {
            for (const line of lines) {
              try {
                const obj = JSON.parse(line.trim());
                parsed.push(obj);
              } catch {
                // Try to repair single line
                const repaired = repairAndParseJSON(line);
                if (repaired.length > 0) parsed.push(...repaired);
              }
            }
          }
          
          // Method 2: If line parsing failed, try array parsing with repair
          if (parsed.length === 0) {
            parsed = repairAndParseJSON(content);
          }
          
          console.log(`[analyze-sentiment] Batch ${batchIndex + 1}: ${parsed.length}/${batchTexts.length} parsed`);

          // Map results by index
          const resultMap = new Map<number, any>();
          for (const r of parsed) {
            const idx = r.i ?? r.index ?? parsed.indexOf(r);
            if (typeof idx === 'number' && idx >= 0 && idx < batchTexts.length) {
              resultMap.set(idx, r);
            }
          }

          // Build final results
          const batchResults: SentimentResult[] = [];
          const defaultKpi = { trust: 0, optimism: 0, frustration: 0, clarity: 0, access: 0, fairness: 0 };
          const polarityMap: Record<string, 'positive' | 'neutral' | 'negative'> = { 
            pos: 'positive', positive: 'positive',
            neu: 'neutral', neutral: 'neutral',
            neg: 'negative', negative: 'negative'
          };
          
          for (let i = 0; i < batchTexts.length; i++) {
            const r = resultMap.get(i) || parsed[i];
            
            if (r) {
              const nodeId = r.n || r.node || nodes[0].id;
              const matchedNode = nodes.find(n => n.id === nodeId) || nodes[0];
              const pol = r.p || r.polarity || 'neu';
              
              batchResults.push({
                text: batchTexts[i],
                nodeId: matchedNode.id,
                nodeName: matchedNode.name,
                polarity: polarityMap[pol] || 'neutral',
                polarityScore: parseFloat(r.s) || 0,
                kpiScores: {
                  trust: parseFloat(r.t) || 0,
                  optimism: parseFloat(r.o) || 0,
                  frustration: parseFloat(r.f) || 0,
                  clarity: parseFloat(r.cl) || 0,
                  access: parseFloat(r.a) || 0,
                  fairness: parseFloat(r.fa) || 0,
                },
                confidence: Math.min(0.95, parseFloat(r.c) || 0.5),
              });
            } else {
              // Fallback for missing results
              batchResults.push({
                text: batchTexts[i],
                nodeId: nodes[0].id,
                nodeName: nodes[0].name,
                polarity: 'neutral',
                polarityScore: 0,
                kpiScores: defaultKpi,
                confidence: 0.3,
              });
            }
          }

          return batchResults;
        }

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
