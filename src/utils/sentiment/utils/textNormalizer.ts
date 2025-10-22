export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s.,!?-]/g, '') // Remove special chars but keep punctuation
    .slice(0, 5000); // Limit length for performance
}

export function isShortText(text: string): boolean {
  return text.trim().split(/\s+/).length < 20;
}

export function isLongText(text: string): boolean {
  return text.trim().split(/\s+/).length > 500;
}

export function chunkLongText(text: string, maxTokens: number = 400): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let tokenCount = 0;
  
  for (const sentence of sentences) {
    const sentenceTokens = Math.ceil(sentence.length / 4);
    
    if (tokenCount + sentenceTokens > maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [sentence];
      tokenCount = sentenceTokens;
    } else {
      currentChunk.push(sentence);
      tokenCount += sentenceTokens;
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }
  
  return chunks.length > 0 ? chunks : [text];
}
