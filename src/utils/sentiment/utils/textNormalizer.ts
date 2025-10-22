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

export function chunkLongText(text: string, chunkSize: number = 500): string[] {
  const words = text.trim().split(/\s+/);
  const chunks: string[] = [];
  
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  
  return chunks;
}
