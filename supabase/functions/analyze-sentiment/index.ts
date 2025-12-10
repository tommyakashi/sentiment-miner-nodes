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

const BATCH_SIZE = 75; // Larger batches with tool calling reliability
const PARALLEL_BATCHES = 2; // Process 2 batches concurrently

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

    console.log(`[analyze-sentiment] Starting parallel analysis: ${texts.length} texts, ${nodes.length} nodes, batch size ${BATCH_SIZE}, parallelism ${PARALLEL_BATCHES}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Create detailed node list with keywords for better matching
    const nodesList = nodes.map(n => `- ${n.id}: "${n.name}" (keywords: ${n.keywords.slice(0, 5).join(', ')})`).join('\n');
    const nodeIds = nodes.map(n => n.id).join(', ');
    const systemPrompt = `You are a sentiment analyzer that categorizes research-related texts into thematic nodes.

AVAILABLE NODES (you MUST use one of these exact IDs for bestMatchingNodeId):
${nodesList}

CRITICAL: Distribute texts across ALL relevant nodes based on their actual content. Each text should match the node whose theme is most relevant to the text's subject matter. Do NOT default to just one node.

For each text, determine:
1. bestMatchingNodeId: Choose from [${nodeIds}] based on which theme the text discusses
2. polarity: "positive", "neutral", or "negative"
3. polarityScore: -1 (very negative) to +1 (very positive)
4. confidence: 0 to 1
5. kpiScores: trust, optimism, frustration, clarity, access, fairness (each -1 to +1)`;

    const totalBatches = Math.ceil(texts.length / BATCH_SIZE);

    // Tool definition for structured output
    const analysisTools = [
      {
        type: "function",
        function: {
          name: "submit_analysis_results",
          description: "Submit the sentiment analysis results for all texts",
          parameters: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    polarity: { type: "string", enum: ["positive", "neutral", "negative"] },
                    polarityScore: { type: "number", description: "Score from -1 (negative) to 1 (positive)" },
                    bestMatchingNodeId: { type: "string", description: "ID of the best matching node" },
                    confidence: { type: "number", description: "Confidence score from 0 to 1" },
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

    // Create streaming response using Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        const sendEvent = (eventType: string, data: any) => {
          const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        // Send initial progress
        sendEvent('progress', { 
          type: 'start', 
          totalTexts: texts.length, 
          totalBatches 
        });

        const allResults: SentimentResult[] = [];

        // Process a single batch with tool calling
        async function processBatch(batchIndex: number, batchTexts: string[]): Promise<SentimentResult[]> {
          console.log(`[analyze-sentiment] Batch ${batchIndex + 1}/${totalBatches} (${batchTexts.length} texts)`);
          
          const textsForPrompt = batchTexts.map((t, i) => `[${i}] "${t.slice(0, 250)}"`).join('\n');
          const userPrompt = `Analyze these ${batchTexts.length} texts and call submit_analysis_results with one result per text:\n${textsForPrompt}`;

          try {
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
                  { role: "user", content: userPrompt }
                ],
                tools: analysisTools,
                tool_choice: { type: "function", function: { name: "submit_analysis_results" } },
                max_tokens: 20000,
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[analyze-sentiment] AI error batch ${batchIndex + 1}: ${response.status} - ${errorText}`);
              
              if (response.status === 429) {
                throw new Error('rate_limit');
              }
              if (response.status === 402) {
                throw new Error('credits_exhausted');
              }
              throw new Error(`AI request failed: ${response.status}`);
            }

            const data = await response.json();
            
            // Extract results from tool call
            let parsed: AnalysisItem[] = [];
            const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
            
            if (toolCall?.function?.arguments) {
              try {
                const args = JSON.parse(toolCall.function.arguments);
                parsed = args.results || [];
                console.log(`[analyze-sentiment] Batch ${batchIndex + 1} tool call: ${parsed.length} results`);
              } catch (toolParseError) {
                console.error(`[analyze-sentiment] Tool parse error batch ${batchIndex + 1}:`, toolParseError);
              }
            }
            
            // Fallback: try to extract from content if tool call failed
            if (parsed.length === 0) {
              const content = data.choices?.[0]?.message?.content || '';
              if (content) {
                try {
                  let jsonStr = content.trim();
                  if (jsonStr.includes('```')) {
                    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
                    if (match && match[1]) jsonStr = match[1].trim();
                  }
                  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
                  if (arrayMatch) jsonStr = arrayMatch[0];
                  parsed = JSON.parse(jsonStr);
                  console.log(`[analyze-sentiment] Batch ${batchIndex + 1} content fallback: ${parsed.length} results`);
                } catch {
                  console.error(`[analyze-sentiment] Fallback parse failed batch ${batchIndex + 1}`);
                }
              }
            }

            // Map parsed results to full SentimentResult objects
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
          } catch (batchError) {
            console.error(`[analyze-sentiment] Batch ${batchIndex + 1} error:`, batchError);
            throw batchError;
          }
        }

        // Process batches in parallel groups
        let rateLimited = false;
        let creditsExhausted = false;

        for (let groupStart = 0; groupStart < totalBatches && !rateLimited && !creditsExhausted; groupStart += PARALLEL_BATCHES) {
          const groupEnd = Math.min(groupStart + PARALLEL_BATCHES, totalBatches);
          const batchPromises: Promise<{ batchIndex: number; results: SentimentResult[] }>[] = [];

          // Create batch promises for this parallel group
          for (let batchIndex = groupStart; batchIndex < groupEnd; batchIndex++) {
            const startIdx = batchIndex * BATCH_SIZE;
            const batchTexts = texts.slice(startIdx, startIdx + BATCH_SIZE);
            
            // Send batch progress
            sendEvent('progress', { 
              type: 'batch_start', 
              batch: batchIndex + 1, 
              totalBatches,
              processedCount: allResults.length
            });

            batchPromises.push(
              processBatch(batchIndex, batchTexts)
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

          // Wait for all batches in this parallel group
          const batchResultsArray = await Promise.all(batchPromises);

          // Process results in order
          for (const { batchIndex, results } of batchResultsArray.sort((a, b) => a.batchIndex - b.batchIndex)) {
            if (results.length > 0) {
              allResults.push(...results);
              
              // Stream batch results
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
        console.log(`[analyze-sentiment] Complete: ${allResults.length} results in ${totalTime}ms`);

        // Send final completion event
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
