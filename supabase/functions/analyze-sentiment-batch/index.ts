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

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      throw new Error('texts array is required');
    }

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      throw new Error('nodes array is required');
    }

    console.log(`Analyzing ${texts.length} texts across ${nodes.length} nodes (AI disabled)`);

    const results: SentimentResult[] = [];

    // AI analysis removed - return basic keyword matching
    for (const text of texts) {
      // Find matching node by keywords
      let matchedNode = nodes[0]; // Default to first node
      for (const node of nodes) {
        const textLower = text.toLowerCase();
        if (node.keywords.some((kw: string) => textLower.includes(kw.toLowerCase()))) {
          matchedNode = node;
          break;
        }
      }

      results.push({
        text,
        nodeId: matchedNode.id,
        nodeName: matchedNode.name,
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
        confidence: 0.5,
      });
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
