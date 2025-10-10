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
  // More nuanced scoring based on confidence
  const threshold = 0.6; // Confidence threshold for strong sentiment
  
  let polarityScore: number;
  let polarity: 'positive' | 'neutral' | 'negative';
  
  if (label === 'POSITIVE') {
    // Scale positive sentiment: 0.5-1.0 confidence -> 0 to 1 polarity
    if (score >= threshold) {
      polarityScore = 0.3 + (score - threshold) * 1.75; // Maps 0.6-1.0 to 0.3-1.0
    } else {
      polarityScore = (score - 0.5) * 0.6; // Maps 0.5-0.6 to 0-0.06
    }
    polarity = score >= 0.55 ? 'positive' : 'neutral';
  } else if (label === 'NEGATIVE') {
    // Scale negative sentiment similarly
    if (score >= threshold) {
      polarityScore = -(0.3 + (score - threshold) * 1.75);
    } else {
      polarityScore = -(score - 0.5) * 0.6;
    }
    polarity = score >= 0.55 ? 'negative' : 'neutral';
  } else {
    polarityScore = 0;
    polarity = 'neutral';
  }
  
  return { polarityScore, polarity };
}
