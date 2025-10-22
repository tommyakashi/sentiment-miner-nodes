import { pipeline } from '@huggingface/transformers';

let sentimentPipeline: any = null;

export async function initializeSentimentModel() {
  if (!sentimentPipeline) {
    console.log('Initializing sentiment model...');
    try {
      sentimentPipeline = await pipeline(
        'sentiment-analysis',
        'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
        { device: 'wasm' }
      );
      console.log('Sentiment model initialized successfully');
    } catch (error) {
      console.error('Failed to initialize sentiment model:', error);
      throw new Error('Failed to load sentiment analysis model. Please refresh and try again.');
    }
  }
  return sentimentPipeline;
}

export interface SentimentOutput {
  label: string;
  score: number;
}

export async function analyzeSentiment(text: string): Promise<SentimentOutput> {
  const model = await initializeSentimentModel();
  const result = await model(text) as any;
  return result[0];
}

export function calculatePolarityScore(label: string, score: number): { polarityScore: number; polarity: 'positive' | 'neutral' | 'negative' } {
  // Improved scoring with lower threshold and logarithmic scaling
  const threshold = 0.52; // Lower threshold for more nuanced detection
  const neutralThreshold = 0.53; // Tighter neutral range
  
  let polarityScore: number;
  let polarity: 'positive' | 'neutral' | 'negative';
  
  if (label === 'POSITIVE') {
    // Logarithmic scaling for more nuanced positive sentiment
    if (score >= threshold) {
      const normalized = (score - threshold) / (1 - threshold); // 0 to 1
      polarityScore = Math.log10(1 + normalized * 9) / Math.log10(10); // Log scale
    } else {
      polarityScore = (score - 0.5) / (threshold - 0.5) * 0.2; // Small positive
    }
    polarity = score >= neutralThreshold ? 'positive' : 'neutral';
  } else if (label === 'NEGATIVE') {
    // Logarithmic scaling for negative sentiment
    if (score >= threshold) {
      const normalized = (score - threshold) / (1 - threshold);
      polarityScore = -(Math.log10(1 + normalized * 9) / Math.log10(10));
    } else {
      polarityScore = -((score - 0.5) / (threshold - 0.5) * 0.2);
    }
    polarity = score >= neutralThreshold ? 'negative' : 'neutral';
  } else {
    polarityScore = 0;
    polarity = 'neutral';
  }
  
  return { polarityScore, polarity };
}
