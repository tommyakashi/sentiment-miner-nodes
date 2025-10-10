import type { Node, SentimentResult, KPIScore, NodeAnalysis } from '@/types/sentiment';
import { analyzeSentiment, calculatePolarityScore } from '../models/sentimentModel';
import { generateEmbedding, cosineSimilarity } from '../models/embeddingModel';
import { extractKeywords } from '../extractors/keywordExtractor';

// Cache for node keyword embeddings
const nodeEmbeddingCache = new Map<string, number[]>();

// Cache for text embeddings to avoid redundant generation
const textEmbeddingCache = new Map<string, number[]>();

// KPI concept definitions
const KPI_CONCEPTS = {
  trust: ['trust', 'reliable', 'honest', 'transparent', 'credible', 'dependable', 'authentic'],
  optimism: ['hope', 'optimistic', 'positive', 'encouraging', 'promising', 'bright', 'confident'],
  frustration: ['frustration', 'annoying', 'difficult', 'problem', 'issue', 'struggle', 'challenging'],
  clarity: ['clear', 'understand', 'simple', 'obvious', 'transparent', 'straightforward', 'explicit'],
  access: ['access', 'available', 'easy', 'convenient', 'reachable', 'obtainable', 'open'],
  fairness: ['fair', 'equal', 'just', 'equitable', 'balanced', 'impartial', 'unbiased'],
};

const kpiEmbeddingCache = new Map<string, number[]>();

async function getKPIEmbeddings() {
  if (kpiEmbeddingCache.size === 0) {
    console.log('Generating KPI concept embeddings...');
    for (const [kpi, concepts] of Object.entries(KPI_CONCEPTS)) {
      const conceptText = concepts.join(' ');
      const embedding = await generateEmbedding(conceptText);
      kpiEmbeddingCache.set(kpi, embedding);
    }
  }
  return kpiEmbeddingCache;
}

async function calculateKPIScores(text: string, polarity: number, textEmbedding?: number[]): Promise<KPIScore> {
  const kpiEmbeddings = await getKPIEmbeddings();
  const embedding = textEmbedding || await generateEmbedding(text);

  const scores: KPIScore = {
    trust: 0,
    optimism: 0,
    frustration: 0,
    clarity: 0,
    access: 0,
    fairness: 0,
  };

  for (const [kpi, kpiEmbedding] of kpiEmbeddings.entries()) {
    const similarity = cosineSimilarity(embedding, kpiEmbedding);
    
    // Combine semantic similarity with polarity
    let score = similarity;
    
    if (kpi === 'optimism' && polarity > 0) {
      score *= (1 + polarity * 0.5);
    } else if (kpi === 'frustration' && polarity < 0) {
      score *= (1 + Math.abs(polarity) * 0.5);
    }
    
    scores[kpi as keyof KPIScore] = Math.max(0, Math.min(1, score));
  }

  return scores;
}

async function findBestMatchingNode(
  text: string,
  nodes: Node[],
  textEmbedding?: number[]
): Promise<{ nodeId: string; nodeName: string; confidence: number }> {
  try {
    const embedding = textEmbedding || await generateEmbedding(text);
    let bestMatch = { nodeId: nodes[0].id, nodeName: nodes[0].name, confidence: 0 };

    for (const node of nodes) {
      // Get or create cached embedding for node keywords
      let nodeEmbedding = nodeEmbeddingCache.get(node.id);
      
      if (!nodeEmbedding) {
        const keywordsText = node.keywords.join(' ');
        nodeEmbedding = await generateEmbedding(keywordsText);
        nodeEmbeddingCache.set(node.id, nodeEmbedding);
      }

      const similarity = cosineSimilarity(embedding, nodeEmbedding);

      if (similarity > bestMatch.confidence) {
        bestMatch = {
          nodeId: node.id,
          nodeName: node.name,
          confidence: similarity,
        };
      }
    }

    return bestMatch;
  } catch (error) {
    console.error('Error in node matching:', error);
    // Fallback to first node
    return { nodeId: nodes[0].id, nodeName: nodes[0].name, confidence: 0 };
  }
}

export async function performSentimentAnalysis(
  texts: string[],
  nodes: Node[],
  onProgress?: (progress: number) => void
): Promise<SentimentResult[]> {
  console.log(`Starting sentiment analysis on ${texts.length} texts across ${nodes.length} nodes`);
  
  const results: SentimentResult[] = [];
  const batchSize = 50;

  try {
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, Math.min(i + batchSize, texts.length));
      
      const batchResults = await Promise.all(
        batch.map(async (text, batchIndex) => {
          try {
            // Generate text embedding once and cache it
            const textEmbedding = await generateEmbedding(text);
            textEmbeddingCache.set(text, textEmbedding);

            // Run sentiment analysis and node matching in parallel
            const [sentimentResult, { nodeId, nodeName, confidence }] = await Promise.all([
              analyzeSentiment(text),
              findBestMatchingNode(text, nodes, textEmbedding)
            ]);

            const { polarityScore, polarity } = calculatePolarityScore(
              sentimentResult.label,
              sentimentResult.score
            );

            // Calculate KPI scores using cached embedding
            const kpiScores = await calculateKPIScores(text, polarityScore, textEmbedding);

            return {
              text,
              nodeId,
              nodeName,
              polarity,
              polarityScore,
              kpiScores,
              confidence: Math.min(sentimentResult.score, confidence),
            } as SentimentResult;
          } catch (error) {
            console.error(`Error analyzing text ${i + batchIndex}:`, error);
            // Return a neutral result on error
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
              confidence: 0,
            } as SentimentResult;
          }
        })
      );

      results.push(...batchResults);

      if (onProgress) {
        const progress = Math.min(100, Math.round((results.length / texts.length) * 100));
        onProgress(progress);
      }
    }

    console.log('Sentiment analysis complete');
    return results;
  } catch (error) {
    console.error('Fatal error in sentiment analysis:', error);
    throw error;
  }
}

export function aggregateNodeAnalysis(results: SentimentResult[]): NodeAnalysis[] {
  const nodeMap = new Map<string, SentimentResult[]>();

  // Group results by node
  results.forEach(result => {
    if (!nodeMap.has(result.nodeId)) {
      nodeMap.set(result.nodeId, []);
    }
    nodeMap.get(result.nodeId)!.push(result);
  });

  // Calculate aggregates for each node
  return Array.from(nodeMap.entries()).map(([nodeId, nodeResults]) => {
    const totalTexts = nodeResults.length;
    const avgPolarity = nodeResults.reduce((sum, r) => sum + r.polarityScore, 0) / totalTexts;

    const avgKpiScores: KPIScore = {
      trust: 0,
      optimism: 0,
      frustration: 0,
      clarity: 0,
      access: 0,
      fairness: 0,
    };

    Object.keys(avgKpiScores).forEach(kpi => {
      avgKpiScores[kpi as keyof KPIScore] = 
        nodeResults.reduce((sum, r) => sum + r.kpiScores[kpi as keyof KPIScore], 0) / totalTexts;
    });

    const sentimentDistribution = {
      positive: nodeResults.filter(r => r.polarity === 'positive').length,
      neutral: nodeResults.filter(r => r.polarity === 'neutral').length,
      negative: nodeResults.filter(r => r.polarity === 'negative').length,
    };

    return {
      nodeId,
      nodeName: nodeResults[0].nodeName,
      totalTexts,
      avgPolarity,
      avgKpiScores,
      sentimentDistribution,
    };
  });
}

export { extractKeywords };
