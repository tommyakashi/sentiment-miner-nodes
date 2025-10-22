import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ThemeResult {
  word: string;
  frequency: number;
  sentiment: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { texts } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      throw new Error('texts array is required');
    }

    console.log(`Extracting themes from ${texts.length} texts`);

    // Sample texts if too many (max 100 for theme extraction)
    const sampleTexts = texts.length > 100 
      ? texts.sort(() => Math.random() - 0.5).slice(0, 100)
      : texts;

    const combinedSample = sampleTexts.join('\n---\n');

    const prompt = `Analyze the following texts and identify 10-15 key themes or topics being discussed. 

For each theme, provide:
1. A concise 1-3 word label (e.g., "Customer Service", "Product Quality", "Pricing")
2. How frequently it appears (estimate as percentage 0-100)
3. Overall sentiment toward that theme (-1 to 1 scale)

Texts to analyze:
${combinedSample.substring(0, 12000)}

Respond in this exact format:
Theme: [label]
Frequency: [0-100]
Sentiment: [-1 to 1]

Theme: [label]
Frequency: [0-100]
Sentiment: [-1 to 1]

...and so on.

Focus on meaningful themes, NOT generic words like "such", "between", "https", or other filler words.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at identifying meaningful themes and topics in text data. Extract only substantive, meaningful themes.'
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

    console.log('AI theme analysis:', analysis);

    // Parse themes from AI response
    const themes: ThemeResult[] = [];
    const themeBlocks = analysis.split(/Theme:/i).slice(1); // Skip first empty split

    for (const block of themeBlocks) {
      const labelMatch = block.match(/^\s*([^\n]+)/);
      const frequencyMatch = block.match(/Frequency:\s*([\d.]+)/i);
      const sentimentMatch = block.match(/Sentiment:\s*([-\d.]+)/i);

      if (labelMatch && frequencyMatch && sentimentMatch) {
        const label = labelMatch[1].trim().replace(/[\[\]]/g, '');
        const frequency = parseFloat(frequencyMatch[1]);
        const sentiment = parseFloat(sentimentMatch[1]);

        themes.push({
          word: label,
          frequency: Math.round(frequency),
          sentiment: Math.max(-1, Math.min(1, sentiment))
        });
      }
    }

    // Sort by frequency
    themes.sort((a, b) => b.frequency - a.frequency);

    console.log(`Extracted ${themes.length} themes`);

    return new Response(JSON.stringify({ themes }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in extract-themes:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        themes: []
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
