import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

interface KPIScore {
  trust: number;
  optimism: number;
  frustration: number;
  clarity: number;
  access: number;
  fairness: number;
}

interface SentimentResult {
  text: string;
  nodeId: string;
  nodeName: string;
  polarity: 'positive' | 'neutral' | 'negative';
  polarityScore: number;
  kpiScores: KPIScore;
  confidence: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { texts, nodes } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      throw new Error('texts array is required');
    }

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      throw new Error('nodes array is required');
    }

    console.log(`Processing ${texts.length} texts with ${nodes.length} nodes`);

    const results: SentimentResult[] = [];

    // Process in batches to avoid timeout
    const batchSize = 20;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(texts.length / batchSize)}`);

      const batchPromises = batch.map(async (text: string) => {
        // Analyze this text with AI
        const prompt = `Analyze the following text for sentiment and match it to the most relevant topic.

Text: "${text}"

Topics to match against:
${nodes.map((n: Node) => `- ${n.name}: ${n.keywords.join(', ')}`).join('\n')}

Provide analysis in this exact format:
- Sentiment: [positive/neutral/negative]
- Sentiment Score: [number between -1 and 1]
- Confidence: [number between 0 and 1]
- Best Matching Topic: [exact topic name from list]
- KPI Scores (0-1 scale):
  * Trust: [0-1]
  * Optimism: [0-1]
  * Frustration: [0-1]
  * Clarity: [0-1]
  * Access: [0-1]
  * Fairness: [0-1]

Be concise and analytical.`;

        try {
          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-lite',
              messages: [
                {
                  role: 'system',
                  content: 'You are a sentiment analysis expert. Provide precise, numerical analysis.'
                },
                { role: 'user', content: prompt }
              ],
            }),
          });

          if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            console.error(`AI Gateway error: ${aiResponse.status} - ${errorText}`);
            throw new Error(`AI Gateway error: ${aiResponse.status}`);
          }

          const aiData = await aiResponse.json();
          const analysis = aiData.choices[0].message.content;

          // Parse the AI response
          const sentimentMatch = analysis.match(/Sentiment:\s*\[?(positive|neutral|negative)\]?/i);
          const scoreMatch = analysis.match(/Sentiment Score:\s*\[?([-\d.]+)\]?/);
          const confidenceMatch = analysis.match(/Confidence:\s*\[?([\d.]+)\]?/);
          const topicMatch = analysis.match(/Best Matching Topic:\s*\[?([^\]]+)\]?/i);
          
          const trustMatch = analysis.match(/Trust:\s*\[?([\d.]+)\]?/);
          const optimismMatch = analysis.match(/Optimism:\s*\[?([\d.]+)\]?/);
          const frustrationMatch = analysis.match(/Frustration:\s*\[?([\d.]+)\]?/);
          const clarityMatch = analysis.match(/Clarity:\s*\[?([\d.]+)\]?/);
          const accessMatch = analysis.match(/Access:\s*\[?([\d.]+)\]?/);
          const fairnessMatch = analysis.match(/Fairness:\s*\[?([\d.]+)\]?/);

          const polarity = (sentimentMatch?.[1]?.toLowerCase() || 'neutral') as 'positive' | 'neutral' | 'negative';
          const polarityScore = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
          const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.7;
          
          // Find matching node
          const topicName = topicMatch?.[1]?.trim();
          let matchedNode = nodes.find((n: Node) => 
            n.name.toLowerCase() === topicName?.toLowerCase()
          );
          
          // Fallback: match by keywords
          if (!matchedNode) {
            matchedNode = nodes[0]; // Default to first node
            for (const node of nodes) {
              const textLower = text.toLowerCase();
              if (node.keywords.some((kw: string) => textLower.includes(kw.toLowerCase()))) {
                matchedNode = node;
                break;
              }
            }
          }

          const kpiScores: KPIScore = {
            trust: trustMatch ? Math.max(0, Math.min(1, parseFloat(trustMatch[1]))) : 0.5,
            optimism: optimismMatch ? Math.max(0, Math.min(1, parseFloat(optimismMatch[1]))) : 0.5,
            frustration: frustrationMatch ? Math.max(0, Math.min(1, parseFloat(frustrationMatch[1]))) : 0.5,
            clarity: clarityMatch ? Math.max(0, Math.min(1, parseFloat(clarityMatch[1]))) : 0.5,
            access: accessMatch ? Math.max(0, Math.min(1, parseFloat(accessMatch[1]))) : 0.5,
            fairness: fairnessMatch ? Math.max(0, Math.min(1, parseFloat(fairnessMatch[1]))) : 0.5,
          };

          return {
            text,
            nodeId: matchedNode.id,
            nodeName: matchedNode.name,
            polarity,
            polarityScore,
            kpiScores,
            confidence,
          };
        } catch (error) {
          console.error('Error analyzing text:', error);
          // Return neutral result on error
          return {
            text,
            nodeId: nodes[0].id,
            nodeName: nodes[0].name,
            polarity: 'neutral' as const,
            polarityScore: 0,
            kpiScores: {
              trust: 0.5,
              optimism: 0.5,
              frustration: 0.5,
              clarity: 0.5,
              access: 0.5,
              fairness: 0.5,
            },
            confidence: 0.3,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    console.log(`Successfully processed ${results.length} texts`);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-sentiment-batch:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        results: []
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
