import type { Node, SentimentResult, KPIScore, NodeAnalysis } from '@/types/sentiment';
import { analyzeSentiment, analyzeSentimentBatch, calculatePolarityScore, initializeSentimentModel } from '../models/sentimentModel';
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
    console.log('Generating KPI concept embeddings in parallel...');
    const kpiEntries = Object.entries(KPI_CONCEPTS);
    const embeddings = await Promise.all(
      kpiEntries.map(([kpi, concepts]) => {
        const conceptText = `This represents ${kpi}. It relates to: ${concepts.join(', ')}. Key aspects include ${concepts.slice(0, 3).join(' and ')}.`;
        return generateEmbedding(conceptText);
      })
    );
    kpiEntries.forEach(([kpi], index) => {
      kpiEmbeddingCache.set(kpi, embeddings[index]);
    });
  }
  return kpiEmbeddingCache;
}

// Pre-build keyword frequency map for efficient matching
function buildKeywordFrequencyMap(text: string, kpiConcepts: Record<string, string[]> = KPI_CONCEPTS): Map<string, number> {
  const normalized = normalizeText(text);
  const frequencyMap = new Map<string, number>();
  
  const domainWeights: Record<string, Record<string, number>> = {
    trust: { reliable: 1.2, honest: 1.3, credible: 1.2 },
    optimism: { hope: 1.3, positive: 1.2, encouraging: 1.2 },
    frustration: { frustration: 1.3, annoying: 1.2, difficult: 1.2 },
    clarity: { clear: 1.3, simple: 1.2, obvious: 1.2 },
    access: { access: 1.3, available: 1.2, easy: 1.2 },
    fairness: { fair: 1.3, equal: 1.2, just: 1.2 },
  };
  
  for (const [kpi, keywords] of Object.entries(kpiConcepts)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        const weight = domainWeights[kpi]?.[keyword] || 1.0;
        frequencyMap.set(`${kpi}:${keyword}`, weight);
      }
    }
  }
  
  return frequencyMap;
}

async function calculateKPIScores(
  text: string,
  normalizedText: string,
  keywordFrequencyMap: Map<string, number>,
  polarity: number,
  sentimentConfidence: number,
  textEmbedding: number[]
): Promise<KPIScore> {
  const kpiEmbeddings = await getKPIEmbeddings();

  const scores: KPIScore = {
    trust: 0,
    optimism: 0,
    frustration: 0,
    clarity: 0,
    access: 0,
    fairness: 0,
  };

  for (const [kpi, kpiEmbedding] of kpiEmbeddings.entries()) {
    const similarity = cosineSimilarity(textEmbedding, kpiEmbedding);
    
    // Base score from semantic similarity (decoupled from polarity)
    let baseScore = similarity;
    
    // Apply polarity as directional adjustment, not amplification
    if (kpi === 'optimism' && polarity > 0) {
      baseScore += polarity * 0.2;
    } else if (kpi === 'frustration' && polarity < 0) {
      baseScore += Math.abs(polarity) * 0.2;
    } else if (kpi === 'trust' && polarity > 0) {
      baseScore += polarity * 0.15;
    } else if (kpi === 'clarity' && Math.abs(polarity) < 0.2) {
      baseScore += 0.1; // Neutral statements tend to be clear
    }
    
    // Efficient keyword boost using pre-built frequency map
    const keywords = KPI_CONCEPTS[kpi as keyof typeof KPI_CONCEPTS];
    const keywordCount = keywords.reduce((count, keyword) => {
      return count + (keywordFrequencyMap.get(`${kpi}:${keyword}`) || 0);
    }, 0);
    
    // Keyword boost as primary signal
    const keywordBoost = Math.min(keywordCount * 0.25, 0.4);
    const score = Math.min(1.0, baseScore + keywordBoost);
    
    scores[kpi as keyof KPIScore] = Math.max(0, Math.min(1, score));
  }

  return scores;
}

// Pre-compute node embeddings with richer context in parallel
async function precomputeNodeEmbeddings(nodes: Node[]): Promise<void> {
  console.log('Precomputing node embeddings in parallel...');
  const nodesToCompute = nodes.filter(node => !nodeEmbeddingCache.has(node.id));
  
  if (nodesToCompute.length === 0) return;
  
  const embeddings = await Promise.all(
    nodesToCompute.map(node => {
      const contextText = `This topic is about: ${node.keywords.slice(0, 5).join(', ')}. It relates to ${node.keywords.slice(5).join(' and ')}.`;
      return generateEmbedding(contextText);
    })
  );
  
  nodesToCompute.forEach((node, index) => {
    nodeEmbeddingCache.set(node.id, embeddings[index]);
  });
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
  customKpiKeywords?: Record<string, string[]>,
  onProgress?: (progress: number) => void,
  onStatus?: (status: string) => void
): Promise<SentimentResult[]> {
  console.log(`Starting sentiment analysis on ${texts.length} texts across ${nodes.length} nodes`);
  
  // Use custom KPI keywords if provided
  const activeKpiConcepts = customKpiKeywords || KPI_CONCEPTS;
  
  const results: SentimentResult[] = [];
  const batchSize = 250;
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
    
    // PHASE 3: Normalize texts and pre-detect long texts
    if (onStatus) onStatus('Preparing texts...');
    const normalizedTextCache = new Map<string, string>();
    const keywordFrequencyCache = new Map<string, Map<string, number>>();
    const longTextIndices = new Set<number>();
    const longTextChunks = new Map<number, string[]>(); // Cache chunk lists
    const allTextsToEmbed: string[] = [];
    const normalizedTextsArray: string[] = []; // For batch sentiment
    
    texts.forEach((text, index) => {
      const normalized = normalizeText(text);
      normalizedTextCache.set(text, normalized);
      normalizedTextsArray.push(normalized);
      keywordFrequencyCache.set(text, buildKeywordFrequencyMap(text, activeKpiConcepts));
      
      if (isLongText(text)) {
        longTextIndices.add(index);
        const chunks = chunkLongText(text, 500).map(normalizeText);
        longTextChunks.set(index, chunks);
        allTextsToEmbed.push(...chunks);
      }
      
      allTextsToEmbed.push(normalized);
    });
    
    // PHASE 4: Batch generate ALL embeddings (full texts + chunks)
    if (onStatus) onStatus('Generating text embeddings...');
    const textEmbeddings = await generateBatchEmbeddings(allTextsToEmbed);
    
    // PHASE 5: Batch analyze sentiment for all texts
    if (onStatus) onStatus('Analyzing sentiment (batch mode)...');
    const allSentimentResults = await analyzeSentimentBatch(normalizedTextsArray);
    
    // PHASE 6: Process results in batches
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
            const globalIndex = i + batchIndex;
            const normalizedText = normalizedTextCache.get(text)!;
            const keywordFrequencyMap = keywordFrequencyCache.get(text)!;
            
            let finalEmbedding = textEmbeddings.get(normalizedText);
            
            if (!finalEmbedding) {
              throw new Error('Embedding not found');
            }

            // Use pre-computed chunk embeddings for long texts
            if (longTextIndices.has(globalIndex)) {
              const cachedChunks = longTextChunks.get(globalIndex);
              if (cachedChunks && cachedChunks.length > 0) {
                const chunkEmbeddings = cachedChunks
                  .map(chunk => textEmbeddings.get(chunk))
                  .filter((emb): emb is number[] => emb !== undefined);
                
                if (chunkEmbeddings.length > 0) {
                  finalEmbedding = chunkEmbeddings[0].map((_, idx) => 
                    chunkEmbeddings.reduce((sum, emb) => sum + emb[idx], 0) / chunkEmbeddings.length
                  );
                }
              }
            }

            // Get cached sentiment result and find node match
            const sentimentResult = allSentimentResults[globalIndex];
            const nodeMatch = findBestMatchingNodeVectorized(finalEmbedding, nodes, nodeEmbeddingCache);

            let { polarityScore, polarity } = calculatePolarityScore(
              sentimentResult.label,
              sentimentResult.score
            );

            // Dampen confidence and polarity for short texts
            let adjustedSentimentScore = sentimentResult.score;
            if (isShortText(text)) {
              adjustedSentimentScore = Math.min(0.75, sentimentResult.score * 0.85);
              polarityScore *= 0.6;
            }

            // Calculate KPI scores with cached data
            const kpiScores = await calculateKPIScores(
              text,
              normalizedText,
              keywordFrequencyMap,
              polarityScore,
              adjustedSentimentScore,
              finalEmbedding
            );

            // Separate sentiment and node confidence, penalize disagreement
            const sentimentConfidence = adjustedSentimentScore;
            const nodeMatchConfidence = nodeMatch.confidence;
            const agreement = 1 - Math.abs(sentimentConfidence - nodeMatchConfidence);
            const confidence = (sentimentConfidence * 0.5 + nodeMatchConfidence * 0.5) * agreement;

            successCount++;
            return {
              text,
              nodeId: nodeMatch.nodeId,
              nodeName: nodeMatch.nodeName,
              polarity,
              polarityScore,
              kpiScores,
              confidence: Math.min(0.95, confidence),
            } as SentimentResult;
          } catch (error) {
            console.error(`Error analyzing text ${i + batchIndex}:`, error);
            return null;
          }
        })
      );

      // Filter out failed analyses
      const validResults = batchResults.filter((r): r is SentimentResult => r !== null);
      results.push(...validResults);

      if (onProgress) {
        const progress = Math.min(100, Math.round((results.length) / texts.length * 100));
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
