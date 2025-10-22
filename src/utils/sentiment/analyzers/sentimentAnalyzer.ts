import type { Node, SentimentResult, KPIScore, NodeAnalysis } from '@/types/sentiment';
import { analyzeSentiment, calculatePolarityScore, initializeSentimentModel } from '../models/sentimentModel';
import { generateEmbedding, generateBatchEmbeddings, cosineSimilarity, initializeEmbeddingModel } from '../models/embeddingModel';
import { extractKeywords } from '../extractors/keywordExtractor';
import { normalizeText, isShortText, isLongText, chunkLongText } from '../utils/textNormalizer';

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
      // Richer context for better semantic matching
      const conceptText = `This represents ${kpi}. It relates to: ${concepts.join(', ')}. Key aspects include ${concepts.slice(0, 3).join(' and ')}.`;
      const embedding = await generateEmbedding(conceptText);
      kpiEmbeddingCache.set(kpi, embedding);
    }
  }
  return kpiEmbeddingCache;
}

async function calculateKPIScores(text: string, polarity: number, sentimentConfidence: number, textEmbedding?: number[]): Promise<KPIScore> {
  const kpiEmbeddings = await getKPIEmbeddings();
  const embedding = textEmbedding || await generateEmbedding(text);
  const normalizedText = normalizeText(text);

  const scores: KPIScore = {
    trust: 0,
    optimism: 0,
    frustration: 0,
    clarity: 0,
    access: 0,
    fairness: 0,
  };

  // Domain-specific adjustments
  const domainWeights: Record<string, Record<string, number>> = {
    trust: { reliable: 1.2, honest: 1.3, credible: 1.2 },
    optimism: { hope: 1.3, positive: 1.2, encouraging: 1.2 },
    frustration: { frustration: 1.3, annoying: 1.2, difficult: 1.2 },
    clarity: { clear: 1.3, simple: 1.2, obvious: 1.2 },
    access: { access: 1.3, available: 1.2, easy: 1.2 },
    fairness: { fair: 1.3, equal: 1.2, just: 1.2 },
  };

  for (const [kpi, kpiEmbedding] of kpiEmbeddings.entries()) {
    const similarity = cosineSimilarity(embedding, kpiEmbedding);
    
    // Weight by sentiment confidence: more confident sentiment = stronger signal
    let score = similarity * (1 + Math.abs(polarity) * sentimentConfidence * 0.8);
    
    // Keyword frequency boost
    const keywords = KPI_CONCEPTS[kpi as keyof typeof KPI_CONCEPTS];
    const keywordCount = keywords.reduce((count, keyword) => {
      const weight = domainWeights[kpi]?.[keyword] || 1.0;
      return count + (normalizedText.includes(keyword) ? weight : 0);
    }, 0);
    
    if (keywordCount > 0) {
      score *= (1 + Math.min(keywordCount * 0.15, 0.5)); // Cap boost at 50%
    }
    
    // Domain-specific polarity adjustments
    if (kpi === 'optimism' && polarity > 0) {
      score *= (1 + polarity * 0.6);
    } else if (kpi === 'frustration' && polarity < 0) {
      score *= (1 + Math.abs(polarity) * 0.6);
    }
    
    scores[kpi as keyof KPIScore] = Math.max(0, Math.min(1, score));
  }

  return scores;
}

// Pre-compute node embeddings with richer context
async function precomputeNodeEmbeddings(nodes: Node[]): Promise<void> {
  console.log('Precomputing node embeddings...');
  for (const node of nodes) {
    if (!nodeEmbeddingCache.has(node.id)) {
      // Richer semantic context
      const contextText = `This topic is about: ${node.keywords.slice(0, 5).join(', ')}. It relates to ${node.keywords.slice(5).join(' and ')}.`;
      const nodeEmbedding = await generateEmbedding(contextText);
      nodeEmbeddingCache.set(node.id, nodeEmbedding);
    }
  }
}

// Vectorized node matching - compute all similarities at once
function findBestMatchingNodeVectorized(
  textEmbedding: number[],
  nodes: Node[],
  nodeEmbeddings: Map<string, number[]>
): { nodeId: string; nodeName: string; confidence: number } {
  let bestMatch = { nodeId: nodes[0].id, nodeName: nodes[0].name, confidence: 0 };

  for (const node of nodes) {
    const nodeEmbedding = nodeEmbeddings.get(node.id);
    if (!nodeEmbedding) continue;

    const similarity = cosineSimilarity(textEmbedding, nodeEmbedding);

    if (similarity > bestMatch.confidence) {
      bestMatch = {
        nodeId: node.id,
        nodeName: node.name,
        confidence: similarity,
      };
    }
  }

  return bestMatch;
}

export async function performSentimentAnalysis(
  texts: string[],
  nodes: Node[],
  onProgress?: (progress: number) => void,
  onStatus?: (status: string) => void
): Promise<SentimentResult[]> {
  console.log(`Starting sentiment analysis on ${texts.length} texts across ${nodes.length} nodes`);
  
  const results: SentimentResult[] = [];
  const batchSize = 250; // Increased from 50
  const startTime = Date.now();
  let successCount = 0;

  try {
    // PHASE 1: Pre-initialize models
    if (onStatus) onStatus('Loading AI models...');
    await Promise.all([
      initializeSentimentModel(),
      initializeEmbeddingModel(),
      getKPIEmbeddings(),
    ]);
    
    // PHASE 2: Precompute node embeddings
    if (onStatus) onStatus('Preparing node embeddings...');
    await precomputeNodeEmbeddings(nodes);
    
    // PHASE 3: Normalize and prepare texts
    if (onStatus) onStatus('Preparing texts...');
    const normalizedTexts = texts.map(normalizeText);
    
    // PHASE 4: Batch generate ALL text embeddings upfront
    if (onStatus) onStatus('Generating text embeddings...');
    const textEmbeddings = await generateBatchEmbeddings(normalizedTexts);
    
    // PHASE 5: Process sentiment in batches
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, Math.min(i + batchSize, texts.length));
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(texts.length / batchSize);
      
      // Calculate ETA
      if (results.length > 0) {
        const elapsed = Date.now() - startTime;
        const rate = results.length / elapsed;
        const remaining = texts.length - results.length;
        const etaMs = remaining / rate;
        const etaSeconds = Math.round(etaMs / 1000);
        
        if (onStatus) {
          onStatus(`Analyzing batch ${batchNum}/${totalBatches} • ${successCount}/${results.length} successful • ETA: ${etaSeconds}s`);
        }
      } else {
        if (onStatus) onStatus(`Analyzing batch ${batchNum}/${totalBatches}...`);
      }
      
      const batchResults = await Promise.all(
        batch.map(async (text, batchIndex) => {
          try {
            const normalizedText = normalizeText(text);
            const textEmbedding = textEmbeddings.get(normalizedText);
            
            if (!textEmbedding) {
              throw new Error('Embedding not found');
            }

            // Handle long texts by chunking and averaging
            let finalEmbedding = textEmbedding;
            if (isLongText(text)) {
              const chunks = chunkLongText(text, 500);
              const chunkEmbeddings = await generateBatchEmbeddings(chunks.map(normalizeText));
              const embeddingArrays = Array.from(chunkEmbeddings.values());
              
              // Average embeddings
              finalEmbedding = embeddingArrays[0].map((_, idx) => 
                embeddingArrays.reduce((sum, emb) => sum + emb[idx], 0) / embeddingArrays.length
              );
            }

            // Run sentiment analysis and node matching in parallel
            const [sentimentResult, nodeMatch] = await Promise.all([
              analyzeSentiment(text),
              Promise.resolve(findBestMatchingNodeVectorized(finalEmbedding, nodes, nodeEmbeddingCache))
            ]);

            const { polarityScore, polarity } = calculatePolarityScore(
              sentimentResult.label,
              sentimentResult.score
            );

            // Adjust confidence for short texts
            let adjustedSentimentScore = sentimentResult.score;
            if (isShortText(text)) {
              adjustedSentimentScore = Math.max(0.6, sentimentResult.score * 1.15);
            }

            // Calculate KPI scores with improved context
            const kpiScores = await calculateKPIScores(text, polarityScore, adjustedSentimentScore, finalEmbedding);

            // Better confidence calculation
            const confidence = (adjustedSentimentScore * 0.6) + (nodeMatch.confidence * 0.4);

            successCount++;
            return {
              text,
              nodeId: nodeMatch.nodeId,
              nodeName: nodeMatch.nodeName,
              polarity,
              polarityScore,
              kpiScores,
              confidence: Math.min(0.99, confidence),
            } as SentimentResult;
          } catch (error) {
            console.error(`Error analyzing text ${i + batchIndex}:`, error);
            // Skip failed analyses - don't add fake neutral results
            return null;
          }
        })
      );

      // Filter out failed analyses
      const validResults = batchResults.filter((r): r is SentimentResult => r !== null);
      results.push(...validResults);

      if (onProgress) {
        const progress = Math.min(100, Math.round((i + batch.length) / texts.length * 100));
        onProgress(progress);
      }
    }

    if (onStatus) onStatus('Finalizing results...');
    
    // Log success rate
    const successRate = (successCount / texts.length) * 100;
    console.log(`Sentiment analysis complete: ${successCount}/${texts.length} successful (${successRate.toFixed(1)}%)`);
    
    if (successRate < 90) {
      console.warn(`Warning: Success rate below 90% (${successRate.toFixed(1)}%)`);
    }
    
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
