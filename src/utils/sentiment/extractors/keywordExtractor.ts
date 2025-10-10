import { generateEmbedding, cosineSimilarity } from '../models/embeddingModel';

const STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
  'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
  'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
  'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
  'is', 'was', 'are', 'been', 'has', 'had', 'were', 'said', 'did', 'having',
  'may', 'should', 'am', 'being', 'very', 'much', 'more', 'really', 'too'
]);

function calculateTFIDF(text: string): Map<string, number> {
  const words = tokenize(text);
  const wordFrequency = new Map<string, number>();
  
  // Calculate term frequency
  words.forEach(word => {
    wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
  });
  
  const maxFreq = Math.max(...Array.from(wordFrequency.values()), 1);
  const scores = new Map<string, number>();
  
  // Normalize by max frequency for single document
  wordFrequency.forEach((freq, word) => {
    scores.set(word, freq / maxFreq);
  });
  
  return scores;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => 
      word.length > 3 && 
      !STOP_WORDS.has(word) &&
      !/^\d+$/.test(word)
    );
}

export async function extractKeywords(
  texts: string[], 
  maxKeywords: number = 10
): Promise<string[]> {
  try {
    if (texts.length === 0) return [];

    // Combine all texts for overall keyword extraction
    const combinedText = texts.join(' ');
    
    // Use TF-IDF for initial keyword extraction
    const scores = calculateTFIDF(combinedText);
    
    if (!scores || scores.size === 0) {
      return fallbackKeywordExtraction(combinedText, maxKeywords);
    }

    // Get top candidates based on TF-IDF
    const candidates = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxKeywords * 3) // Get more candidates for diversity
      .map(([word]) => word);

    // Use embeddings to diversify keywords (avoid semantic duplicates)
    const diverseKeywords = await diversifyKeywords(candidates, maxKeywords);
    
    return diverseKeywords;
  } catch (error) {
    console.error('Error in keyword extraction:', error);
    const combinedText = texts.join(' ');
    return fallbackKeywordExtraction(combinedText, maxKeywords);
  }
}

async function diversifyKeywords(candidates: string[], maxKeywords: number): Promise<string[]> {
  if (candidates.length <= maxKeywords) return candidates;

  try {
    // Generate embeddings for all candidates
    const embeddings = await Promise.all(
      candidates.map(word => generateEmbedding(word))
    );

    // Select diverse keywords using maximal marginal relevance
    const selected: string[] = [];
    const selectedEmbeddings: number[][] = [];
    
    // Add the first (highest TF-IDF) keyword
    selected.push(candidates[0]);
    selectedEmbeddings.push(embeddings[0]);

    // Iteratively add most diverse keywords
    while (selected.length < maxKeywords && selected.length < candidates.length) {
      let maxMinSimilarity = -1;
      let bestIndex = -1;

      for (let i = 0; i < candidates.length; i++) {
        if (selected.includes(candidates[i])) continue;

        // Calculate minimum similarity to already selected keywords
        let minSimilarity = 1;
        for (const selectedEmb of selectedEmbeddings) {
          const similarity = cosineSimilarity(embeddings[i], selectedEmb);
          minSimilarity = Math.min(minSimilarity, similarity);
        }

        // We want maximum of the minimum similarities (most diverse)
        if (minSimilarity > maxMinSimilarity) {
          maxMinSimilarity = minSimilarity;
          bestIndex = i;
        }
      }

      if (bestIndex !== -1) {
        selected.push(candidates[bestIndex]);
        selectedEmbeddings.push(embeddings[bestIndex]);
      } else {
        break;
      }
    }

    return selected;
  } catch (error) {
    console.error('Error diversifying keywords:', error);
    return candidates.slice(0, maxKeywords);
  }
}

function fallbackKeywordExtraction(text: string, maxKeywords: number): string[] {
  const words = tokenize(text);
  const frequency = new Map<string, number>();

  words.forEach(word => {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  });

  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}
