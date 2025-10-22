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
  const neutralThreshold = 0.70;
  
  let polarityScore: number;
  let polarity: 'positive' | 'neutral' | 'negative';
  
  // Sigmoid smoothing for gradual transitions
  const sigmoid = (x: number) => 2 / (1 + Math.exp(-5 * x)) - 1;
  
  if (label === 'POSITIVE') {
    if (score >= threshold) {
      const normalized = (score - threshold) / (1 - threshold);
      polarityScore = sigmoid(normalized * 2 - 1) * 0.7;
    } else {
      polarityScore = (score - 0.5) / (threshold - 0.5) * 0.15;
    }
    polarity = score >= neutralThreshold ? 'positive' : 'neutral';
  } else if (label === 'NEGATIVE') {
    if (score >= threshold) {
      const normalized = (score - threshold) / (1 - threshold);
      polarityScore = sigmoid(normalized * 2 - 1) * -0.7;
    } else {
      polarityScore = -((score - 0.5) / (threshold - 0.5) * 0.15);
    }
    polarity = score >= neutralThreshold ? 'negative' : 'neutral';
  } else {
    polarityScore = 0;
    polarity = 'neutral';
  }
  
  // Dampen polarity for low confidence scores
  if (score < 0.75) {
    const dampening = Math.max(0.3, (score - 0.5) / 0.25);
    polarityScore *= dampening;
  }
  
  return { polarityScore, polarity };
}
