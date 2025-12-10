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

const BATCH_SIZE = 25;

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

    console.log(`[analyze-sentiment] Starting streaming analysis: ${texts.length} texts, ${nodes.length} nodes`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Create compact node list for prompt
    const nodesList = nodes.map(n => `${n.id}:${n.name}`).join(', ');
    const systemPrompt = `Sentiment analyzer. For each text return JSON object with: polarity("positive"/"neutral"/"negative"), polarityScore(-1 to 1), bestMatchingNodeId(from: ${nodesList}), confidence(0-1), kpiScores{trust,optimism,frustration,clarity,access,fairness}(each -1 to 1). Return ONLY a JSON array, no markdown.`;

    const totalBatches = Math.ceil(texts.length / BATCH_SIZE);

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

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const startIdx = batchIndex * BATCH_SIZE;
          const batchTexts = texts.slice(startIdx, startIdx + BATCH_SIZE);
          
          console.log(`[analyze-sentiment] Batch ${batchIndex + 1}/${totalBatches} (${batchTexts.length} texts)`);
          
          // Send batch progress
          sendEvent('progress', { 
            type: 'batch_start', 
            batch: batchIndex + 1, 
            totalBatches,
            processedCount: allResults.length
          });

          const textsForPrompt = batchTexts.map((t, i) => `${i}:"${t.slice(0, 200)}"`).join('\n');
          const userPrompt = `Analyze ${batchTexts.length} texts:\n${textsForPrompt}`;

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
                temperature: 0.1,
                max_tokens: 8000,
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[analyze-sentiment] AI error: ${response.status} - ${errorText}`);
              
              if (response.status === 429) {
                sendEvent('error', { 
                  type: 'rate_limit', 
                  message: 'Rate limited, returning partial results',
                  partialResults: allResults.length
                });
                break;
              }
              if (response.status === 402) {
                sendEvent('error', { 
                  type: 'credits_exhausted', 
                  message: 'AI credits exhausted'
                });
                break;
              }
              throw new Error(`AI request failed: ${response.status}`);
            }

            let data: any;
            try {
              data = await response.json();
            } catch (jsonErr) {
              console.error(`[analyze-sentiment] Failed to parse AI response as JSON:`, jsonErr);
              data = { choices: [{ message: { content: '[]' } }] };
            }
            
            const content = data.choices?.[0]?.message?.content || '';
            
            // Parse JSON from response
            let parsed: any[];
            try {
              let jsonStr = content.trim();
              
              if (jsonStr.includes('```')) {
                const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (match && match[1]) {
                  jsonStr = match[1].trim();
                } else {
                  jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                }
              }
              
              const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
              if (arrayMatch) {
                jsonStr = arrayMatch[0];
              }
              
              parsed = JSON.parse(jsonStr);
              
              if (!Array.isArray(parsed)) {
                throw new Error('Response is not an array');
              }
              
              console.log(`[analyze-sentiment] Batch ${batchIndex + 1} parsed: ${parsed.length} results`);
            } catch (parseError) {
              console.error(`[analyze-sentiment] Parse error batch ${batchIndex + 1}:`, parseError);
              parsed = batchTexts.map(() => ({
                polarity: 'neutral',
                polarityScore: 0,
                bestMatchingNodeId: nodes[0].id,
                confidence: 0.3,
                kpiScores: { trust: 0, optimism: 0, frustration: 0, clarity: 0, access: 0, fairness: 0 }
              }));
            }

            // Map parsed results to full SentimentResult objects
            const batchResults: SentimentResult[] = [];
            for (let i = 0; i < batchTexts.length; i++) {
              const result = parsed[i] || {
                polarity: 'neutral',
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

            allResults.push(...batchResults);

            // Stream batch results immediately
            sendEvent('batch_complete', { 
              batch: batchIndex + 1, 
              totalBatches,
              results: batchResults,
              processedCount: allResults.length,
              totalCount: texts.length
            });

          } catch (batchError) {
            console.error(`[analyze-sentiment] Batch ${batchIndex + 1} error:`, batchError);
            sendEvent('batch_error', { 
              batch: batchIndex + 1, 
              error: batchError instanceof Error ? batchError.message : 'Unknown error'
            });
          }

          // Small delay between batches
          if (batchIndex < totalBatches - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
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
