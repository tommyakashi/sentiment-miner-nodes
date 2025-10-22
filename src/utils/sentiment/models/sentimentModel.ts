import { pipeline } from '@huggingface/transformers';

let sentimentPipeline: any = null;
const sentimentCache = new Map<string, SentimentOutput>();

export async function initializeSentimentModel() {
  if (!sentimentPipeline) {
    console.log('Initializing sentiment model...');
    try {
      sentimentPipeline = await pipeline(
        'sentiment-analysis',
        'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
        { device: 'wasm', dtype: 'q8' }
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
  const cacheKey = text.slice(0, 200);
  if (sentimentCache.has(cacheKey)) {
    return sentimentCache.get(cacheKey)!;
  }
  
  const model = await initializeSentimentModel();
  const result = await model(text) as any;
  const output = result[0];
  sentimentCache.set(cacheKey, output);
  return output;
}

export async function analyzeSentimentBatch(texts: string[]): Promise<SentimentOutput[]> {
  const model = await initializeSentimentModel();
  const results = await model(texts) as any;
  return results.map((r: any) => r[0] || r);
}

export function calculatePolarityScore(label: string, score: number): { polarityScore: number; polarity: 'positive' | 'neutral' | 'negative' } {
  const threshold = 0.65;
  const neutralThreshold = 0.60; // Lowered from 0.70 for more sensitivity
  
  let polarityScore: number;
  let polarity: 'positive' | 'neutral' | 'negative';
  
  // Linear mapping for easier interpretation (replaces sigmoid)
  if (label === 'POSITIVE') {
    if (score >= threshold) {
      // Linear interpolation from threshold to 1.0 -> maps to 0.3 to 1.0
      const normalized = (score - threshold) / (1 - threshold);
      polarityScore = 0.3 + (normalized * 0.7); // Range: 0.3 to 1.0
    } else {
      // Linear interpolation from 0.5 to threshold -> maps to 0 to 0.3
      polarityScore = (score - 0.5) / (threshold - 0.5) * 0.3;
    }
    polarity = score >= neutralThreshold ? 'positive' : 'neutral';
  } else if (label === 'NEGATIVE') {
    if (score >= threshold) {
      // Linear interpolation from threshold to 1.0 -> maps to -0.3 to -1.0
      const normalized = (score - threshold) / (1 - threshold);
      polarityScore = -(0.3 + (normalized * 0.7)); // Range: -0.3 to -1.0
    } else {
      // Linear interpolation from 0.5 to threshold -> maps to 0 to -0.3
      polarityScore = -((score - 0.5) / (threshold - 0.5) * 0.3);
    }
    polarity = score >= neutralThreshold ? 'negative' : 'neutral';
  } else {
    polarityScore = 0;
    polarity = 'neutral';
  }
  
  // Reduced dampening - only for very low confidence scores below 0.60
  if (score < 0.60) {
    const dampening = Math.max(0.5, (score - 0.5) / 0.10); // More lenient than before
    polarityScore *= dampening;
  }
  
  return { polarityScore, polarity };
}
