import type { Node, SentimentResult, KPIScore, NodeAnalysis } from '@/types/sentiment';
import { analyzeSentiment, analyzeSentimentBatch, calculatePolarityScore, initializeSentimentModel } from '../models/sentimentModel';
import { generateEmbedding, generateBatchEmbeddings, cosineSimilarity, initializeEmbeddingModel } from '../models/embeddingModel';
import { extractKeywords } from '../extractors/keywordExtractor';
import { normalizeText, isShortText, isLongText, chunkLongText } from '../utils/textNormalizer';

// Cache for node keyword embeddings
const nodeEmbeddingCache = new Map<string, number[]>();

// Cache for text embeddings to avoid redundant generation
const textEmbeddingCache = new Map<string, number[]>();

// KPI concept definitions - based on NRC emotion lexicon, VADER, and LIWC research lexicons
const KPI_CONCEPTS = {
  trust: [
    'trust', 'reliable', 'honest', 'transparent', 'credible', 'dependable', 'authentic',
    'trustworthy', 'confidence', 'faith', 'integrity', 'truthful', 'genuine', 'legitimate',
    'reputable', 'believable', 'verified', 'validated', 'secure', 'safe', 'consistent',
    'accountability', 'responsible', 'ethical', 'sincere', 'loyal', 'faithful'
  ],
  optimism: [
    'hope', 'optimistic', 'positive', 'encouraging', 'promising', 'bright', 'confident',
    'hopeful', 'upbeat', 'favorable', 'beneficial', 'advantageous', 'constructive',
    'enthusiastic', 'motivated', 'inspired', 'excited', 'eager', 'cheerful', 'happy',
    'joy', 'pleased', 'satisfied', 'success', 'improve', 'progress', 'forward', 'better',
    'opportunity', 'potential', 'possible', 'achieve', 'accomplish', 'thrive', 'flourish'
  ],
  frustration: [
    'frustration', 'annoying', 'difficult', 'problem', 'issue', 'struggle', 'challenging',
    'frustrated', 'irritating', 'aggravating', 'exasperating', 'troublesome', 'bothersome',
    'obstacle', 'barrier', 'hindrance', 'impediment', 'setback', 'delay', 'stuck',
    'blocked', 'prevented', 'limited', 'constrained', 'restricted', 'complicated',
    'confusing', 'unclear', 'ambiguous', 'vague', 'uncertain', 'inconsistent', 'unreliable',
    'fail', 'failure', 'error', 'mistake', 'wrong', 'broken', 'ineffective', 'inadequate'
  ],
  clarity: [
    'clear', 'understand', 'simple', 'obvious', 'transparent', 'straightforward', 'explicit',
    'understandable', 'comprehensible', 'intelligible', 'lucid', 'coherent', 'logical',
    'rational', 'reasonable', 'sensible', 'plain', 'evident', 'apparent', 'manifest',
    'unambiguous', 'precise', 'accurate', 'exact', 'specific', 'defined', 'explained',
    'articulated', 'expressed', 'communicated', 'distinct', 'definite', 'certain'
  ],
  access: [
    'access', 'available', 'easy', 'convenient', 'reachable', 'obtainable', 'open',
    'accessible', 'usable', 'approachable', 'attainable', 'achievable', 'feasible',
    'practical', 'simple', 'effortless', 'straightforward', 'user-friendly', 'intuitive',
    'navigate', 'find', 'locate', 'retrieve', 'get', 'obtain', 'acquire', 'procure',
    'enable', 'permit', 'allow', 'facilitate', 'support', 'accommodate', 'inclusive'
  ],
  fairness: [
    'fair', 'equal', 'just', 'equitable', 'balanced', 'impartial', 'unbiased',
    'justice', 'equality', 'equity', 'fairness', 'objectivity', 'neutral', 'evenhanded',
    'unprejudiced', 'nondiscriminatory', 'inclusive', 'representative', 'diverse',
    'proportional', 'reasonable', 'appropriate', 'legitimate', 'lawful', 'rightful',
    'ethical', 'moral', 'principled', 'integrity', 'honest', 'truthful', 'transparent'
  ],
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

// Negation words for context-aware keyword matching
const NEGATION_WORDS = [
  'not', 'no', 'never', 'dont', 'didnt', 'wont', 'cant', 'couldnt', 'shouldnt',
  'wouldnt', 'isnt', 'arent', 'wasnt', 'werent', 'lack', 'without', 'absence',
  'missing', 'barely', 'hardly', 'scarcely', 'neither', 'nor', 'none'
];

// Pre-build keyword frequency map with negation detection
function buildKeywordFrequencyMap(text: string): Map<string, number> {
  const normalized = normalizeText(text);
  const words = normalized.split(/\s+/);
  const frequencyMap = new Map<string, number>();
  
  const domainWeights: Record<string, Record<string, number>> = {
    trust: { 
      trustworthy: 1.4, credible: 1.3, reliable: 1.3, authentic: 1.2, verified: 1.2,
      integrity: 1.3, accountability: 1.2, ethical: 1.2
    },
    optimism: { 
      hope: 1.4, optimistic: 1.3, hopeful: 1.3, promising: 1.2, encouraging: 1.2,
      potential: 1.2, opportunity: 1.2, progress: 1.2, thrive: 1.3
    },
    frustration: { 
      frustration: 1.4, frustrated: 1.3, obstacle: 1.3, barrier: 1.3, blocked: 1.3,
      fail: 1.4, failure: 1.3, error: 1.2, broken: 1.2, inadequate: 1.2
    },
    clarity: { 
      clear: 1.4, understandable: 1.3, comprehensible: 1.3, explicit: 1.2,
      unambiguous: 1.3, precise: 1.2, coherent: 1.2, logical: 1.2
    },
    access: { 
      accessible: 1.4, available: 1.3, reachable: 1.3, usable: 1.3,
      'user-friendly': 1.3, intuitive: 1.2, facilitate: 1.2, inclusive: 1.2
    },
    fairness: { 
      fair: 1.4, equitable: 1.3, just: 1.3, impartial: 1.3, unbiased: 1.3,
      equality: 1.3, justice: 1.3, inclusive: 1.2, representative: 1.2
    },
  };
  
  for (const [kpi, keywords] of Object.entries(KPI_CONCEPTS)) {
    for (const keyword of keywords) {
      const keywordIndex = normalized.indexOf(keyword);
      if (keywordIndex !== -1) {
        // Check for negation in the 3 words before the keyword
        const wordsBeforeKeyword = normalized.slice(Math.max(0, keywordIndex - 30), keywordIndex).split(/\s+/).slice(-3);
        const hasNegation = wordsBeforeKeyword.some(w => NEGATION_WORDS.includes(w));
        
        let weight = domainWeights[kpi]?.[keyword] || 1.0;
        
        // Invert weight if negation is detected
        if (hasNegation) {
          weight = -weight;
        }
        
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
  polarityScore: number, // Now expecting the actual polarity score (-1 to +1)
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
    
    // Base score from semantic similarity
    let baseScore = similarity;
    
    // Efficient keyword matching with negation handling
    const keywords = KPI_CONCEPTS[kpi as keyof typeof KPI_CONCEPTS];
    const keywordSum = keywords.reduce((sum, keyword) => {
      return sum + (keywordFrequencyMap.get(`${kpi}:${keyword}`) || 0);
    }, 0);
    
    // Keyword contribution (can be negative due to negation detection)
    const keywordBoost = Math.max(-0.5, Math.min(0.5, keywordSum * 0.20));
    
    // Combine semantic similarity with keyword signals
    let score = baseScore + keywordBoost;
    
    // CRITICAL: Make KPI scores sentiment-aware
    // For positive KPIs (trust, optimism, clarity, access, fairness): 
    // multiply by (1 + polarityScore) so negative sentiment reduces the score
    // For negative KPI (frustration): 
    // multiply by (1 - polarityScore) so negative sentiment increases frustration
    
    if (kpi === 'frustration') {
      // Negative sentiment increases frustration
      score = score * (1 - polarityScore);
    } else {
      // Positive KPIs: negative sentiment reduces them
      score = score * (1 + polarityScore);
    }
    
    // Normalize to -1.0 to +1.0 range (KPIs can now be negative)
    scores[kpi as keyof KPIScore] = Math.max(-1.0, Math.min(1.0, score));
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
  onProgress?: (progress: number) => void,
  onStatus?: (status: string) => void
): Promise<SentimentResult[]> {
  console.log(`Starting sentiment analysis on ${texts.length} texts across ${nodes.length} nodes`);
  
  const results: SentimentResult[] = [];
  
  // Adaptive batch size based on dataset size and average text length
  const avgTextLength = texts.reduce((sum, t) => sum + t.length, 0) / texts.length;
  let batchSize = 250; // Default
  
  if (texts.length < 100) {
    batchSize = 50; // Smaller batches for small datasets
  } else if (avgTextLength > 1000) {
    batchSize = 100; // Smaller batches for long texts
  } else if (texts.length > 10000) {
    batchSize = 500; // Larger batches for huge datasets
  }
  
  console.log(`Using adaptive batch size: ${batchSize} (avg text length: ${Math.round(avgTextLength)} chars)`);
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
      keywordFrequencyCache.set(text, buildKeywordFrequencyMap(text));
      
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

            // Reduced penalty for short texts - more lenient
            let adjustedSentimentScore = sentimentResult.score;
            if (isShortText(text)) {
              adjustedSentimentScore = Math.min(0.80, sentimentResult.score * 0.90);
              polarityScore *= 0.75;
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

            // Separate sentiment and node confidence - no penalty for disagreement
            // These are independent signals: a text can be confidently negative while weakly matched to a node
            const sentimentConfidence = adjustedSentimentScore;
            const nodeMatchConfidence = nodeMatch.confidence;
            const confidence = sentimentConfidence; // Use only sentiment confidence

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

// Server-side sentiment analysis using Lovable AI
export async function performSentimentAnalysisServer(
  texts: string[],
  nodes: Node[],
  onProgress?: (progress: number) => void,
  onStatus?: (status: string) => void
): Promise<SentimentResult[]> {
  console.log(`[Server] Starting sentiment analysis: ${texts.length} texts, ${nodes.length} nodes`);
  
  if (onStatus) onStatus('Connecting to AI service...');
  if (onProgress) onProgress(5);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase configuration missing');
  }

  // Estimate batches for progress calculation
  const estimatedBatches = Math.ceil(texts.length / 25);
  const progressPerBatch = 70 / estimatedBatches;
  
  try {
    if (onStatus) onStatus(`Analyzing ${texts.length} texts...`);
    if (onProgress) onProgress(10);

    // Simulate batch progress while waiting for response
    let progressValue = 10;
    let simulatedBatch = 0;
    const progressInterval = setInterval(() => {
      if (simulatedBatch < estimatedBatches) {
        simulatedBatch++;
        progressValue = 10 + (simulatedBatch * progressPerBatch);
        if (onStatus) onStatus(`Processing batch ${simulatedBatch}/${estimatedBatches}...`);
        if (onProgress) onProgress(Math.min(progressValue, 85));
      }
    }, 7000); // ~7s per batch based on logs

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min timeout

      const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-sentiment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({ texts, nodes }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      clearInterval(progressInterval);

      if (onStatus) onStatus('Receiving response...');
      if (onProgress) onProgress(88);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        if (response.status === 402) {
          throw new Error('AI credits exhausted. Please add credits to continue.');
        }
        
        throw new Error(errorData.error || `Analysis failed: ${response.status}`);
      }

      if (onStatus) onStatus('Processing results...');
      if (onProgress) onProgress(92);

      const data = await response.json();
      
      if (!data.results || !Array.isArray(data.results)) {
        console.error('[Server] Invalid response structure:', data);
        throw new Error('Invalid response from analysis service');
      }

      if (onStatus) onStatus('Finalizing...');
      if (onProgress) onProgress(98);

      console.log(`[Server] Analysis complete: ${data.results.length} results`);
      
      return data.results as SentimentResult[];
    } catch (fetchError) {
      clearInterval(progressInterval);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('Analysis timed out. Try with fewer texts or check your connection.');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('[Server] Sentiment analysis error:', error);
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

  // Calculate aggregates for each node with validation
  return Array.from(nodeMap.entries())
    .map(([nodeId, nodeResults]) => {
      const totalTexts = nodeResults.length;
      
      // Validation: skip nodes with no results
      if (totalTexts === 0) {
        console.warn(`Node ${nodeId} has 0 results, skipping aggregation`);
        return null;
      }
      
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
  })
  .filter((analysis): analysis is NodeAnalysis => analysis !== null); // Filter out null results
}

export { extractKeywords };
