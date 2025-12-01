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

const BATCH_SIZE = 25; // Process 25 texts per AI call

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { texts, nodes } = await req.json() as { texts: string[]; nodes: Node[] };
    
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

    const nodesList = nodes.map(n => `- "${n.name}" (ID: ${n.id})`).join('\n');
    
    const systemPrompt = `You are a sentiment analysis expert. Analyze texts and classify them by sentiment and topic.

Available topics/nodes:
${nodesList}

For each text, determine:
1. **polarity**: "positive", "neutral", or "negative"
2. **polarityScore**: A number from -1.0 (very negative) to +1.0 (very positive)
3. **bestMatchingNodeId**: The ID of the most relevant topic from the list
4. **confidence**: How confident you are (0.0 to 1.0)
5. **kpiScores**: Rate each KPI from -1.0 to +1.0:
   - trust: Level of trust/credibility expressed
   - optimism: Hopefulness/positive outlook
   - frustration: Annoyance/difficulty expressed
   - clarity: How clear/understandable the subject is
   - access: Ease of access/availability
   - fairness: Perception of fairness/equity

Respond ONLY with a JSON array of results matching the input texts order.`;

    const allResults: SentimentResult[] = [];
    const totalBatches = Math.ceil(texts.length / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * BATCH_SIZE;
      const batchTexts = texts.slice(startIdx, startIdx + BATCH_SIZE);
      
      console.log(`[analyze-sentiment] Processing batch ${batchIndex + 1}/${totalBatches} (${batchTexts.length} texts)`);

      const textsForPrompt = batchTexts.map((t, i) => `[${i}] "${t.slice(0, 500)}${t.length > 500 ? '...' : ''}"`).join('\n\n');

      const userPrompt = `Analyze these ${batchTexts.length} texts:

${textsForPrompt}

Return a JSON array with ${batchTexts.length} objects in order, each having: polarity, polarityScore, bestMatchingNodeId, confidence, kpiScores (trust, optimism, frustration, clarity, access, fairness).`;

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
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[analyze-sentiment] AI error: ${response.status} - ${errorText}`);
        
        if (response.status === 429) {
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

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      // Parse JSON from response (handle markdown code blocks)
      let parsed: any[];
      try {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
        const jsonStr = jsonMatch[1].trim();
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error(`[analyze-sentiment] Failed to parse batch ${batchIndex + 1}:`, parseError);
        console.error(`[analyze-sentiment] Raw content:`, content.slice(0, 500));
        // Create fallback results for this batch
        parsed = batchTexts.map(() => ({
          polarity: 'neutral',
          polarityScore: 0,
          bestMatchingNodeId: nodes[0].id,
          confidence: 0.5,
          kpiScores: { trust: 0, optimism: 0, frustration: 0, clarity: 0, access: 0, fairness: 0 }
        }));
      }

      // Map parsed results to full SentimentResult objects
      for (let i = 0; i < batchTexts.length; i++) {
        const result = parsed[i] || {
          polarity: 'neutral',
          polarityScore: 0,
          bestMatchingNodeId: nodes[0].id,
          confidence: 0.5,
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
          confidence: typeof result.confidence === 'number' ? Math.min(0.95, result.confidence) : 0.5,
        });
      }

      // Small delay between batches to avoid rate limiting
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`[analyze-sentiment] Complete: ${allResults.length} results`);

    return new Response(JSON.stringify({ results: allResults }), {
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
