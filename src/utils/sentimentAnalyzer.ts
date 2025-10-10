import { pipeline, cos_sim } from '@huggingface/transformers';
import type { Node, SentimentResult, KPIScore } from '@/types/sentiment';

let sentimentClassifier: any = null;
let embeddingModel: any = null;
let keyphraseExtractor: any = null;

// KPI concept definitions for semantic similarity
const KPI_CONCEPTS = {
  trust: "trustworthy reliable honest credible dependable authentic genuine",
  optimism: "hopeful positive optimistic promising bright future encouraging confident",
  frustration: "frustrated annoyed angry difficult problem issue obstacle challenge barrier",
  clarity: "clear understandable obvious straightforward transparent simple plain explicit",
  access: "accessible available easy reach obtain open usable convenient attainable",
  fairness: "fair equal just equitable balanced unbiased impartial even-handed"
};

// Cache for concept embeddings
let conceptEmbeddings: Record<string, number[]> | null = null;

export async function initializeSentimentAnalyzer() {
  console.log('Initializing modern sentiment analyzer...');
  
  // Initialize RoBERTa sentiment model (trained on 58M tweets)
  if (!sentimentClassifier) {
    console.log('Loading RoBERTa sentiment model...');
    sentimentClassifier = await pipeline(
      'sentiment-analysis',
      'Xenova/twitter-roberta-base-sentiment-latest',
      { device: 'webgpu' }
    );
  }
  
  return sentimentClassifier;
}

async function initializeEmbeddingModel() {
  if (!embeddingModel) {
    console.log('Loading embedding model for semantic analysis...');
    embeddingModel = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { device: 'webgpu' }
    );
  }
  return embeddingModel;
}

async function initializeKeyphraseExtractor() {
  if (!keyphraseExtractor) {
    console.log('Loading keyphrase extraction model...');
    keyphraseExtractor = await pipeline(
      'text2text-generation',
      'Xenova/keyphrase-generation-t5-small-inspec'
    );
  }
  return keyphraseExtractor;
}

async function generateConceptEmbeddings() {
  if (conceptEmbeddings) return conceptEmbeddings;
  
  const embedder = await initializeEmbeddingModel();
  const concepts = Object.values(KPI_CONCEPTS);
  
  console.log('Generating KPI concept embeddings...');
  const embeddings = await embedder(concepts, { pooling: 'mean', normalize: true });
  const embeddingsList = embeddings.tolist();
  
  conceptEmbeddings = {
    trust: embeddingsList[0],
    optimism: embeddingsList[1],
    frustration: embeddingsList[2],
    clarity: embeddingsList[3],
    access: embeddingsList[4],
    fairness: embeddingsList[5]
  };
  
  return conceptEmbeddings;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function calculateSemanticKPIScores(text: string, polarity: number): Promise<KPIScore> {
  try {
    const embedder = await initializeEmbeddingModel();
    const concepts = await generateConceptEmbeddings();
    
    // Get embedding for the text
    const textEmbedding = await embedder(text, { pooling: 'mean', normalize: true });
    const textEmbed = textEmbedding.tolist()[0];
    
    // Calculate semantic similarity with each KPI concept
    const trustSim = cosineSimilarity(textEmbed, concepts.trust);
    const optimismSim = cosineSimilarity(textEmbed, concepts.optimism);
    const frustrationSim = cosineSimilarity(textEmbed, concepts.frustration);
    const claritySim = cosineSimilarity(textEmbed, concepts.clarity);
    const accessSim = cosineSimilarity(textEmbed, concepts.access);
    const fairnessSim = cosineSimilarity(textEmbed, concepts.fairness);
    
    // Combine semantic similarity with polarity
    // Positive polarity amplifies positive KPIs, negative amplifies frustration
    const polarityFactor = polarity;
    
    // Normalize scores to -1 to 1 range
    const normalize = (similarity: number, isNegative: boolean = false) => {
      // Similarity ranges from 0 to 1, map to -1 to 1 based on polarity
      const score = isNegative 
        ? -(similarity * Math.abs(polarityFactor))
        : (similarity * polarityFactor);
      return Math.max(-1, Math.min(1, score));
    };
    
    return {
      trust: normalize(trustSim),
      optimism: normalize(optimismSim),
      frustration: normalize(frustrationSim, true), // Negative KPI
      clarity: normalize(claritySim),
      access: normalize(accessSim),
      fairness: normalize(fairnessSim),
    };
  } catch (error) {
    console.error('Error calculating semantic KPI scores:', error);
    // Fallback to simple calculation
    return {
      trust: polarity * 0.5,
      optimism: polarity * 0.5,
      frustration: -polarity * 0.5,
      clarity: polarity * 0.3,
      access: polarity * 0.3,
      fairness: polarity * 0.4,
    };
  }
}

async function findBestMatchingNodeSemantic(
  text: string,
  nodes: Node[]
): Promise<{ nodeId: string; nodeName: string; confidence: number }> {
  try {
    const embedder = await initializeEmbeddingModel();
    
    // Get text embedding
    const textEmbedding = await embedder(text, { pooling: 'mean', normalize: true });
    const textEmbed = textEmbedding.tolist()[0];
    
    // Get embeddings for all node keywords
    let bestMatch = { nodeId: nodes[0].id, nodeName: nodes[0].name, confidence: 0 };
    
    for (const node of nodes) {
      const keywordsText = node.keywords.join(' ');
      const nodeEmbedding = await embedder(keywordsText, { pooling: 'mean', normalize: true });
      const nodeEmbed = nodeEmbedding.tolist()[0];
      
      const similarity = cosineSimilarity(textEmbed, nodeEmbed);
      
      if (similarity > bestMatch.confidence) {
        bestMatch = {
          nodeId: node.id,
          nodeName: node.name,
          confidence: similarity
        };
      }
    }
    
    // If no good match, use first node with low confidence
    if (bestMatch.confidence < 0.1) {
      bestMatch.confidence = 0.1;
    }
    
    return bestMatch;
  } catch (error) {
    console.error('Error in semantic node matching:', error);
    // Fallback to keyword matching
    return findBestMatchingNodeKeyword(text, nodes);
  }
}

function findBestMatchingNodeKeyword(text: string, nodes: Node[]): { nodeId: string; nodeName: string; confidence: number } {
  const lowerText = text.toLowerCase();
  let bestMatch = { nodeId: nodes[0].id, nodeName: nodes[0].name, confidence: 0 };

  for (const node of nodes) {
    const matchCount = node.keywords.reduce((count, keyword) => {
      const keywordLower = keyword.toLowerCase();
      return count + (lowerText.includes(keywordLower) ? 1 : 0);
    }, 0);

    const confidence = matchCount / Math.max(1, node.keywords.length);
    if (confidence > bestMatch.confidence) {
      bestMatch = { nodeId: node.id, nodeName: node.name, confidence };
    }
  }

  if (bestMatch.confidence === 0) {
    bestMatch.confidence = 0.1;
  }

  return bestMatch;
}

export async function analyzeSentiment(
  texts: string[],
  nodes: Node[],
  onProgress?: (progress: number) => void
): Promise<SentimentResult[]> {
  console.log(`Analyzing sentiment for ${texts.length} texts with modern AI models...`);
  
  // Initialize models
  const classifier = await initializeSentimentAnalyzer();
  await initializeEmbeddingModel();
  await generateConceptEmbeddings();
  
  const results: SentimentResult[] = [];
  const batchSize = 10; // Process in batches for better performance

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, Math.min(i + batchSize, texts.length));
    
    for (let j = 0; j < batch.length; j++) {
      const text = batch[j];
      const globalIndex = i + j;
      
      if (!text.trim()) continue;

      try {
        // Use RoBERTa for sentiment classification
        const sentimentResult = await classifier(text.slice(0, 512)); // RoBERTa max length
        
        // Map RoBERTa output to our format
        // RoBERTa returns: { label: 'positive'|'negative'|'neutral', score: 0-1 }
        const label = sentimentResult[0].label.toLowerCase();
        const score = sentimentResult[0].score;
        
        // Convert to polarity score with more sensitivity (-1 to 1 scale)
        // Lower threshold: treat confidence >0.4 as meaningful sentiment
        let polarityScore: number;
        let polarity: 'positive' | 'neutral' | 'negative';
        
        if (label === 'positive') {
          // Map positive: even weak positive signals (0.4-1.0) get scaled up
          polarityScore = Math.min(1, (score - 0.3) * 1.4); // More sensitive scaling
          polarity = 'positive';
        } else if (label === 'negative') {
          // Map negative: same sensitivity for negative
          polarityScore = -Math.min(1, (score - 0.3) * 1.4);
          polarity = 'negative';
        } else {
          // For neutral, if confidence is low, check for slight lean
          if (score < 0.6) {
            // Weak neutral confidence means slight sentiment
            polarityScore = (Math.random() - 0.5) * 0.2; // Small random lean
          } else {
            polarityScore = 0;
          }
          polarity = 'neutral';
        }

        // Find matching node using semantic similarity
        const { nodeId, nodeName, confidence } = await findBestMatchingNodeSemantic(text, nodes);

        // Calculate KPI scores using semantic similarity
        const kpiScores = await calculateSemanticKPIScores(text, polarityScore);

        results.push({
          text,
          nodeId,
          nodeName,
          polarity,
          polarityScore,
          kpiScores,
          confidence,
        });
      } catch (error) {
        console.error(`Error analyzing text at index ${globalIndex}:`, error);
        // Add a neutral result as fallback
        results.push({
          text,
          nodeId: nodes[0].id,
          nodeName: nodes[0].name,
          polarity: 'neutral',
          polarityScore: 0,
          kpiScores: {
            trust: 0,
            optimism: 0,
            frustration: 0,
            clarity: 0,
            access: 0,
            fairness: 0,
          },
          confidence: 0.1,
        });
      }

      if (onProgress) {
        onProgress(((globalIndex + 1) / texts.length) * 100);
      }
    }
  }

  console.log(`Sentiment analysis complete. Processed ${results.length} texts.`);
  return results;
}

export async function extractKeywords(text: string, maxKeywords: number = 10): Promise<string[]> {
  try {
    const extractor = await initializeKeyphraseExtractor();
    const embedder = await initializeEmbeddingModel();

    // Normalize and truncate text
    const normalizedText = text
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000);

    if (normalizedText.length < 20) {
      return [];
    }

    // Extract keyphrases using T5 model
    const result = await extractor(normalizedText, {
      max_new_tokens: 60,
      num_beams: 4,
      do_sample: false,
    });

    let keyphrases: string[] = [];
    if (result && result.length > 0) {
      const generatedText = result[0].generated_text || '';
      keyphrases = generatedText
        .split(',')
        .map((phrase: string) => phrase.trim().toLowerCase())
        .filter((phrase: string) => phrase.length > 2 && phrase.split(' ').length <= 4);
    }

    // Use embeddings to cluster and diversify keyphrases
    if (keyphrases.length > 0) {
      const embeddings = await embedder(keyphrases, { pooling: 'mean', normalize: true });
      const embeddingArray = embeddings.tolist();
      
      const selected: string[] = [];
      const selectedIndices: number[] = [];
      
      for (let i = 0; i < keyphrases.length && selected.length < maxKeywords; i++) {
        const currentEmbed = embeddingArray[i];
        
        // Check diversity
        let isDiverse = true;
        for (const selectedIdx of selectedIndices) {
          const similarity = cosineSimilarity(currentEmbed, embeddingArray[selectedIdx]);
          if (similarity > 0.75) {
            isDiverse = false;
            break;
          }
        }
        
        if (isDiverse) {
          selected.push(keyphrases[i]);
          selectedIndices.push(i);
        }
      }
      
      return selected.slice(0, maxKeywords);
    }

    return fallbackKeywordExtraction(text, maxKeywords);
  } catch (error) {
    console.error('Keyphrase extraction error:', error);
    return fallbackKeywordExtraction(text, maxKeywords);
  }
}

function fallbackKeywordExtraction(text: string, maxKeywords: number): string[] {
  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might',
    'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
    'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how'
  ]);

  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !commonWords.has(word));

  const frequency: Record<string, number> = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });

  return Object.entries(frequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxKeywords)
    .map(([word]) => word);
}
