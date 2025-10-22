// Removed embedding imports for performance optimization

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
    
    // Use TF-IDF for keyword extraction (removed embedding diversification for performance)
    const scores = calculateTFIDF(combinedText);
    
    if (!scores || scores.size === 0) {
      return fallbackKeywordExtraction(combinedText, maxKeywords);
    }

    // Get top keywords based on TF-IDF score
    const keywords = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxKeywords)
      .map(([word]) => word);
    
    return keywords;
  } catch (error) {
    console.error('Error in keyword extraction:', error);
    const combinedText = texts.join(' ');
    return fallbackKeywordExtraction(combinedText, maxKeywords);
  }
}

// Removed diversifyKeywords function - no longer needed without embeddings

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
