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
  polarityScore: number;
  bestMatchingNodeId: string;
  confidence: number;
  kpiScores: {
    trust: number;
    optimism: number;
    frustration: number;
    clarity: number;
    access: number;
    fairness: number;
  };
}

const BATCH_SIZE = 100;
const PARALLEL_BATCHES = 3;

// Aggressive JSON object extraction - finds all valid objects even in malformed JSON
function extractJsonObjects(text: string): AnalysisItem[] {
  const results: AnalysisItem[] = [];
  
  // Pattern to match individual result objects
  const objectPattern = /\{[^{}]*"polarity"\s*:\s*"(positive|neutral|negative)"[^{}]*"bestMatchingNodeId"\s*:\s*"[^"]*"[^{}]*\}/g;
  const matches = text.match(objectPattern);
  
  if (matches) {
    for (const match of matches) {
      try {
        // Try to parse each matched object
        const obj = JSON.parse(match);
        if (obj.polarity && obj.bestMatchingNodeId) {
          results.push({
            polarity: obj.polarity,
            polarityScore: typeof obj.polarityScore === 'number' ? obj.polarityScore : 0,
            bestMatchingNodeId: obj.bestMatchingNodeId,
            confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.5,
            kpiScores: {
              trust: obj.kpiScores?.trust ?? 0,
              optimism: obj.kpiScores?.optimism ?? 0,
              frustration: obj.kpiScores?.frustration ?? 0,
              clarity: obj.kpiScores?.clarity ?? 0,
              access: obj.kpiScores?.access ?? 0,
              fairness: obj.kpiScores?.fairness ?? 0,
            }
          });
        }
      } catch {
        // Skip malformed objects
      }
    }
  }
  
  // If pattern matching failed, try line-by-line extraction
  if (results.length === 0) {
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('{') && trimmed.includes('polarity')) {
        try {
          let cleanLine = trimmed;
          if (cleanLine.endsWith(',')) cleanLine = cleanLine.slice(0, -1);
          const obj = JSON.parse(cleanLine);
          if (obj.polarity && obj.bestMatchingNodeId) {
            results.push({
              polarity: obj.polarity,
              polarityScore: typeof obj.polarityScore === 'number' ? obj.polarityScore : 0,
              bestMatchingNodeId: obj.bestMatchingNodeId,
              confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.5,
              kpiScores: {
                trust: obj.kpiScores?.trust ?? 0,
                optimism: obj.kpiScores?.optimism ?? 0,
                frustration: obj.kpiScores?.frustration ?? 0,
                clarity: obj.kpiScores?.clarity ?? 0,
                access: obj.kpiScores?.access ?? 0,
                fairness: obj.kpiScores?.fairness ?? 0,
              }
            });
          }
        } catch {
          // Skip
        }
      }
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

    console.log(`[analyze-sentiment] Starting: ${texts.length} texts, ${nodes.length} nodes, batch ${BATCH_SIZE}, parallelism ${PARALLEL_BATCHES}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const nodesList = nodes.map(n => `${n.id}:"${n.name}"`).join(', ');
    const systemPrompt = `You are a sentiment analyzer. Nodes: [${nodesList}].
For each text in order, return EXACTLY one result object with:
- bestMatchingNodeId: pick from nodes above
- polarity: "positive", "neutral", or "negative"  
- polarityScore: -1 to +1
- confidence: 0 to 1
- kpiScores: {trust, optimism, frustration, clarity, access, fairness} each -1 to +1

IMPORTANT: Return EXACTLY ${BATCH_SIZE} results for ${BATCH_SIZE} texts, in order.`;

    const totalBatches = Math.ceil(texts.length / BATCH_SIZE);

    const analysisTools = [
      {
        type: "function",
        function: {
          name: "submit_analysis_results",
          description: "Submit the sentiment analysis results for all texts in order",
          parameters: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    polarity: { type: "string", enum: ["positive", "neutral", "negative"] },
                    polarityScore: { type: "number" },
                    bestMatchingNodeId: { type: "string" },
                    confidence: { type: "number" },
                    kpiScores: {
                      type: "object",
                      properties: {
                        trust: { type: "number" },
                        optimism: { type: "number" },
                        frustration: { type: "number" },
                        clarity: { type: "number" },
                        access: { type: "number" },
                        fairness: { type: "number" }
                      },
                      required: ["trust", "optimism", "frustration", "clarity", "access", "fairness"]
                    }
                  },
                  required: ["polarity", "polarityScore", "bestMatchingNodeId", "confidence", "kpiScores"]
                }
              }
            },
            required: ["results"]
          }
        }
      }
    ];

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        const sendEvent = (eventType: string, data: any) => {
          const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        sendEvent('progress', { 
          type: 'start', 
          totalTexts: texts.length, 
          totalBatches 
        });

        const allResults: SentimentResult[] = [];

        // Process a single batch with aggressive parsing
        async function processBatch(batchIndex: number, batchTexts: string[], isRetry: boolean = false): Promise<SentimentResult[]> {
          const retryLabel = isRetry ? ' (retry)' : '';
          console.log(`[analyze-sentiment] Batch ${batchIndex + 1}/${totalBatches}${retryLabel} (${batchTexts.length} texts)`);
          
          const textsForPrompt = batchTexts.map((t, i) => `[${i}] "${t.slice(0, 200)}"`).join('\n');
          const userPrompt = `Analyze these ${batchTexts.length} texts. Return exactly ${batchTexts.length} results in order:\n${textsForPrompt}`;

          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
              ],
              tools: analysisTools,
              tool_choice: { type: "function", function: { name: "submit_analysis_results" } },
              max_tokens: 30000,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[analyze-sentiment] Batch ${batchIndex + 1} error: ${response.status} - ${errorText.slice(0, 200)}`);
            
            if (response.status === 429) throw new Error('rate_limit');
            if (response.status === 402) throw new Error('credits_exhausted');
            throw new Error(`AI request failed: ${response.status}`);
          }

          const data = await response.json();
          
          let parsed: AnalysisItem[] = [];
          const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
          
          // Try 1: Parse from tool call arguments
          if (toolCall?.function?.arguments) {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              parsed = args.results || [];
              console.log(`[analyze-sentiment] Batch ${batchIndex + 1} tool call: ${parsed.length}/${batchTexts.length} results`);
            } catch (toolParseError) {
              console.error(`[analyze-sentiment] Tool parse error batch ${batchIndex + 1}:`, toolParseError);
              // Try aggressive extraction from malformed tool call
              const rawArgs = toolCall.function.arguments || '';
              parsed = extractJsonObjects(rawArgs);
              if (parsed.length > 0) {
                console.log(`[analyze-sentiment] Recovered ${parsed.length} from malformed tool call`);
              }
            }
          }
          
          // Try 2: Parse from content field
          if (parsed.length === 0) {
            const content = data.choices?.[0]?.message?.content || '';
            if (content) {
              console.log(`[analyze-sentiment] Batch ${batchIndex + 1} trying content fallback (${content.length} chars)`);
              try {
                let jsonStr = content.trim();
                if (jsonStr.includes('```')) {
                  const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
                  if (match && match[1]) jsonStr = match[1].trim();
                }
                const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
                if (arrayMatch) {
                  parsed = JSON.parse(arrayMatch[0]);
                  console.log(`[analyze-sentiment] Content fallback: ${parsed.length} results`);
                }
              } catch {
                // Try aggressive extraction
                parsed = extractJsonObjects(content);
                if (parsed.length > 0) {
                  console.log(`[analyze-sentiment] Aggressive extraction from content: ${parsed.length} results`);
                }
              }
            }
          }

          // Try 3: If still empty, extract from raw response
          if (parsed.length === 0) {
            const rawResponse = JSON.stringify(data);
            parsed = extractJsonObjects(rawResponse);
            if (parsed.length > 0) {
              console.log(`[analyze-sentiment] Last resort extraction: ${parsed.length} results`);
            }
          }

          // Log parsing success rate
          const parseRate = Math.round((parsed.length / batchTexts.length) * 100);
          console.log(`[analyze-sentiment] Batch ${batchIndex + 1}: ${parsed.length}/${batchTexts.length} parsed (${parseRate}%)`);

          // Map results, using defaults for missing items
          const batchResults: SentimentResult[] = [];
          for (let i = 0; i < batchTexts.length; i++) {
            const result = parsed[i] || {
              polarity: 'neutral' as const,
              polarityScore: 0,
              bestMatchingNodeId: nodes[0].id,
              confidence: 0.3,
              kpiScores: { trust: 0, optimism: 0, frustration: 0, clarity: 0, access: 0, fairness: 0 }
            };

            const matchedNode = nodes.find(n => n.id === result.bestMatchingNodeId) || nodes[0];

            batchResults.push({
              text: batchTexts[i],
              nodeId: matchedNode.id,
              nodeName: matchedNode.name,
              polarity: result.polarity || 'neutral',
              polarityScore: typeof result.polarityScore === 'number' ? result.polarityScore : 0,
              kpiScores: {
                trust: result.kpiScores?.trust ?? 0,
                optimism: result.kpiScores?.optimism ?? 0,
                frustration: result.kpiScores?.frustration ?? 0,
                clarity: result.kpiScores?.clarity ?? 0,
                access: result.kpiScores?.access ?? 0,
                fairness: result.kpiScores?.fairness ?? 0,
              },
              confidence: typeof result.confidence === 'number' ? Math.min(0.95, result.confidence) : 0.3,
            });
          }

          return batchResults;
        }

        // Wrapper with retry for empty/low results
        async function processBatchWithRetry(batchIndex: number, batchTexts: string[]): Promise<SentimentResult[]> {
          try {
            const results = await processBatch(batchIndex, batchTexts, false);
            
            // Count how many results have actual analysis (not just defaults)
            const analyzedCount = results.filter(r => r.confidence > 0.3).length;
            const successRate = analyzedCount / batchTexts.length;
            
            // If less than 50% were actually analyzed, retry once
            if (successRate < 0.5 && batchTexts.length > 0) {
              console.log(`[analyze-sentiment] Batch ${batchIndex + 1} low success (${Math.round(successRate * 100)}%), retrying...`);
              const retryResults = await processBatch(batchIndex, batchTexts, true);
              const retryAnalyzedCount = retryResults.filter(r => r.confidence > 0.3).length;
              
              // Use retry if better
              if (retryAnalyzedCount > analyzedCount) {
                console.log(`[analyze-sentiment] Retry improved: ${retryAnalyzedCount} vs ${analyzedCount}`);
                return retryResults;
              }
            }
            
            return results;
          } catch (error) {
            if (error instanceof Error && (error.message === 'rate_limit' || error.message === 'credits_exhausted')) {
              throw error;
            }
            console.log(`[analyze-sentiment] Batch ${batchIndex + 1} failed, retrying...`);
            try {
              return await processBatch(batchIndex, batchTexts, true);
            } catch (retryError) {
              console.error(`[analyze-sentiment] Batch ${batchIndex + 1} retry also failed`);
              // Return default results rather than failing completely
              return batchTexts.map(text => ({
                text,
                nodeId: nodes[0].id,
                nodeName: nodes[0].name,
                polarity: 'neutral' as const,
                polarityScore: 0,
                kpiScores: { trust: 0, optimism: 0, frustration: 0, clarity: 0, access: 0, fairness: 0 },
                confidence: 0.1,
              }));
            }
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
            
            sendEvent('progress', { 
              type: 'batch_start', 
              batch: batchIndex + 1, 
              totalBatches,
              processedCount: allResults.length
            });

            batchPromises.push(
              processBatchWithRetry(batchIndex, batchTexts)
                .then(results => ({ batchIndex, results }))
                .catch(error => {
                  if (error.message === 'rate_limit') {
                    rateLimited = true;
                    sendEvent('error', { 
                      type: 'rate_limit', 
                      message: 'Rate limited, returning partial results',
                      partialResults: allResults.length
                    });
                  } else if (error.message === 'credits_exhausted') {
                    creditsExhausted = true;
                    sendEvent('error', { 
                      type: 'credits_exhausted', 
                      message: 'AI credits exhausted'
                    });
                  } else {
                    sendEvent('batch_error', { 
                      batch: batchIndex + 1, 
                      error: error.message 
                    });
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
                results: results,
                processedCount: allResults.length,
                totalCount: texts.length
              });
            }
          }
        }

        const totalTime = Date.now() - startTime;
        
        // Calculate actual analysis success rate
        const analyzedResults = allResults.filter(r => r.confidence > 0.3);
        const successRate = Math.round((analyzedResults.length / texts.length) * 100);
        
        console.log(`[analyze-sentiment] Complete: ${allResults.length}/${texts.length} results (${successRate}% analyzed) in ${totalTime}ms`);

        sendEvent('complete', { 
          results: allResults,
          processedCount: allResults.length,
          totalCount: texts.length,
          executionTimeMs: totalTime,
          successRate
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
