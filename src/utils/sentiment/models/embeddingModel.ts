import { pipeline } from '@huggingface/transformers';

let embeddingPipeline: any = null;

export async function initializeEmbeddingModel() {
  if (!embeddingPipeline) {
    console.log('Initializing embedding model...');
    try {
      embeddingPipeline = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { device: 'wasm' }
      );
      console.log('Embedding model initialized successfully');
    } catch (error) {
      console.error('Failed to initialize embedding model:', error);
      throw new Error('Failed to load embedding model. Please refresh and try again.');
    }
  }
  return embeddingPipeline;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const model = await initializeEmbeddingModel();
  const output = await model(text, { pooling: 'mean', normalize: true }) as any;
  return Array.from(output.data);
}

// Batch embedding generation for efficiency
export async function generateBatchEmbeddings(texts: string[]): Promise<Map<string, number[]>> {
  const model = await initializeEmbeddingModel();
  const embeddingMap = new Map<string, number[]>();
  
  // Process in chunks to avoid memory issues
  const chunkSize = 100;
  
  for (let i = 0; i < texts.length; i += chunkSize) {
    const chunk = texts.slice(i, i + chunkSize);
    
    // Generate embeddings in parallel for the chunk
    const results = await Promise.all(
      chunk.map(async (text) => {
        const output = await model(text, { pooling: 'mean', normalize: true }) as any;
        return { text, embedding: Array.from(output.data) as number[] };
      })
    );
    
    // Add to map
    results.forEach(({ text, embedding }) => {
      embeddingMap.set(text, embedding);
    });
  }
  
  return embeddingMap;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
