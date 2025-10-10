import { pipeline, cos_sim } from '@huggingface/transformers';
import type { Node, SentimentResult, KPIScore } from '@/types/sentiment';
import vader from 'vader-sentiment';

let sentimentPipeline: any = null;
let keyphraseExtractor: any = null;
let embeddingModel: any = null;

export async function initializeSentimentAnalyzer() {
  // VADER doesn't need initialization, but keeping for compatibility
  return vader.SentimentIntensityAnalyzer;
}

async function initializeKeyphraseExtractor() {
  if (!keyphraseExtractor) {
    keyphraseExtractor = await pipeline('text2text-generation', 'Xenova/keyphrase-generation-t5-small-inspec');
  }
  return keyphraseExtractor;
}

async function initializeEmbeddingModel() {
  if (!embeddingModel) {
    embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embeddingModel;
}

function calculateKPIScores(text: string, polarity: number): KPIScore {
  // Simple heuristic-based KPI calculation
  // In a real system, this would use more sophisticated NLP
  const lowerText = text.toLowerCase();
  
  const trustWords = ['reliable', 'trust', 'honest', 'transparent', 'credible'];
  const optimismWords = ['hope', 'positive', 'optimistic', 'promising', 'bright'];
  const frustrationWords = ['frustrated', 'annoyed', 'difficult', 'problem', 'issue'];
  const clarityWords = ['clear', 'understand', 'obvious', 'transparent', 'straightforward'];
  const accessWords = ['accessible', 'available', 'open', 'easy', 'reach'];
  const fairnessWords = ['fair', 'equal', 'just', 'equitable', 'balanced'];

  const countWords = (words: string[]) => 
    words.reduce((count, word) => count + (lowerText.includes(word) ? 1 : 0), 0);

  const trust = (countWords(trustWords) / 5) * polarity;
  const optimism = (countWords(optimismWords) / 5) * polarity;
  const frustration = -(countWords(frustrationWords) / 5) * Math.abs(polarity);
  const clarity = (countWords(clarityWords) / 5) * polarity;
  const access = (countWords(accessWords) / 5) * polarity;
  const fairness = (countWords(fairnessWords) / 5) * polarity;

  // Normalize to -1 to 1 range
  const normalize = (score: number) => Math.max(-1, Math.min(1, score));

  return {
    trust: normalize(trust),
    optimism: normalize(optimism),
    frustration: normalize(frustration),
    clarity: normalize(clarity),
    access: normalize(access),
    fairness: normalize(fairness),
  };
}

function findBestMatchingNode(text: string, nodes: Node[]): { nodeId: string; nodeName: string; confidence: number } {
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

  // If no good match, use first node with low confidence
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
  const analyzer = await initializeSentimentAnalyzer();
  const results: SentimentResult[] = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    if (!text.trim()) continue;

    // Use VADER for sentiment analysis
    const vaderScores = analyzer.polarity_scores(text);
    
    // VADER compound score ranges from -1 to 1
    const polarityScore = vaderScores.compound;
    
    // Classify polarity based on compound score
    // VADER standard thresholds: >= 0.05 positive, <= -0.05 negative
    const polarity = polarityScore >= 0.05 ? 'positive' : polarityScore <= -0.05 ? 'negative' : 'neutral';

    // Find matching node
    const { nodeId, nodeName, confidence } = findBestMatchingNode(text, nodes);

    // Calculate KPI scores using VADER's compound score
    const kpiScores = calculateKPIScores(text, polarityScore);

    results.push({
      text,
      nodeId,
      nodeName,
      polarity,
      polarityScore,
      kpiScores,
      confidence,
    });

    if (onProgress) {
      onProgress(((i + 1) / texts.length) * 100);
    }
  }

  return results;
}

export async function extractKeywords(text: string, maxKeywords: number = 10): Promise<string[]> {
  try {
    // Initialize models
    const extractor = await initializeKeyphraseExtractor();
    const embedder = await initializeEmbeddingModel();

    // Normalize text - remove extra whitespace and truncate if too long
    const normalizedText = text
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000); // Limit to 2000 chars for performance

    if (normalizedText.length < 20) {
      return [];
    }

    // Extract keyphrases using T5 model
    const result = await extractor(normalizedText, {
      max_new_tokens: 50,
      num_beams: 3,
    });

    // Parse the generated keyphrases (comma-separated)
    let keyphrases: string[] = [];
    if (result && result.length > 0) {
      const generatedText = result[0].generated_text || '';
      keyphrases = generatedText
        .split(',')
        .map((phrase: string) => phrase.trim().toLowerCase())
        .filter((phrase: string) => phrase.length > 2);
    }

    // If we got keyphrases, cluster similar ones using embeddings
    if (keyphrases.length > 0) {
      const embeddings = await embedder(keyphrases, { pooling: 'mean', normalize: true });
      
      // Simple clustering: keep diverse keyphrases
      const selected: string[] = [];
      const embeddingArray = embeddings.tolist();
      
      for (let i = 0; i < keyphrases.length && selected.length < maxKeywords; i++) {
        const currentEmbed = embeddingArray[i];
        
        // Check if this keyphrase is diverse enough from already selected ones
        let isDiverse = true;
        for (const selectedIdx of selected.map((_, idx) => idx)) {
          const similarity = cosineSimilarity(currentEmbed, embeddingArray[selectedIdx]);
          if (similarity > 0.8) {
            isDiverse = false;
            break;
          }
        }
        
        if (isDiverse) {
          selected.push(keyphrases[i]);
        }
      }
      
      return selected.slice(0, maxKeywords);
    }

    // Fallback to simple frequency-based extraction
    return fallbackKeywordExtraction(text, maxKeywords);
  } catch (error) {
    console.error('Keyphrase extraction error:', error);
    return fallbackKeywordExtraction(text, maxKeywords);
  }
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
