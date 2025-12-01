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

// Reduced batch size to prevent output token truncation
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

    console.log(`[analyze-sentiment] Starting analysis: ${texts.length} texts, ${nodes.length} nodes`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Create compact node list for prompt
    const nodesList = nodes.map(n => `${n.id}:${n.name}`).join(', ');
    
    const systemPrompt = `Sentiment analyzer. For each text return JSON object with: polarity("positive"/"neutral"/"negative"), polarityScore(-1 to 1), bestMatchingNodeId(from: ${nodesList}), confidence(0-1), kpiScores{trust,optimism,frustration,clarity,access,fairness}(each -1 to 1). Return ONLY a JSON array, no markdown.`;

    const allResults: SentimentResult[] = [];
    const totalBatches = Math.ceil(texts.length / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * BATCH_SIZE;
      const batchTexts = texts.slice(startIdx, startIdx + BATCH_SIZE);
      
      console.log(`[analyze-sentiment] Batch ${batchIndex + 1}/${totalBatches} (${batchTexts.length} texts)`);

      // Compact text format
      const textsForPrompt = batchTexts.map((t, i) => `${i}:"${t.slice(0, 200)}"`).join('\n');

      const userPrompt = `Analyze ${batchTexts.length} texts:\n${textsForPrompt}`;

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
          max_tokens: 8000, // Ensure enough tokens for complete response
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[analyze-sentiment] AI error: ${response.status} - ${errorText}`);
        
        if (response.status === 429) {
          // If we have partial results, return them
          if (allResults.length > 0) {
            return new Response(JSON.stringify({ 
              results: allResults,
              isPartial: true,
              processedCount: allResults.length,
              totalCount: texts.length,
              warning: "Rate limited, returning partial results"
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw new Error(`AI request failed: ${response.status}`);
      }

      let data: any;
      try {
        data = await response.json();
      } catch (jsonErr) {
        console.error(`[analyze-sentiment] Failed to parse AI response as JSON:`, jsonErr);
        // Use fallback for this batch
        data = { choices: [{ message: { content: '[]' } }] };
      }
      
      const content = data.choices?.[0]?.message?.content || '';
      
      // Parse JSON from response
      let parsed: any[];
      try {
        let jsonStr = content.trim();
        
        // Strip markdown code blocks if present
        if (jsonStr.includes('```')) {
          const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (match && match[1]) {
            jsonStr = match[1].trim();
          } else {
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          }
        }
        
        // Try to find JSON array in response
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
        console.error(`[analyze-sentiment] Content preview:`, content.slice(0, 200));
        // Create fallback results for this batch
        parsed = batchTexts.map(() => ({
          polarity: 'neutral',
          polarityScore: 0,
          bestMatchingNodeId: nodes[0].id,
          confidence: 0.3,
          kpiScores: { trust: 0, optimism: 0, frustration: 0, clarity: 0, access: 0, fairness: 0 }
        }));
      }

      // Map parsed results to full SentimentResult objects
      for (let i = 0; i < batchTexts.length; i++) {
        const result = parsed[i] || {
          polarity: 'neutral',
          polarityScore: 0,
          bestMatchingNodeId: nodes[0].id,
          confidence: 0.3,
          kpiScores: { trust: 0, optimism: 0, frustration: 0, clarity: 0, access: 0, fairness: 0 }
        };

        const matchedNode = nodes.find(n => n.id === result.bestMatchingNodeId) || nodes[0];

        allResults.push({
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

      // Small delay between batches to avoid rate limiting
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[analyze-sentiment] Complete: ${allResults.length} results in ${totalTime}ms`);

    return new Response(JSON.stringify({ 
      results: allResults,
      isPartial: false,
      processedCount: allResults.length,
      totalCount: texts.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
