let pdfWorker: Worker | null = null;
let jobCounter = 0;
const pendingJobs = new Map<number, { resolve: (texts: string[]) => void; reject: (error: Error) => void }>();

function getWorker(): Worker {
  if (!pdfWorker) {
    pdfWorker = new Worker(new URL('../workers/pdfWorker.ts', import.meta.url), {
      type: 'module'
    });

    pdfWorker.onmessage = (e: MessageEvent) => {
      const { type, id, texts, error, progress, currentPage, totalPages } = e.data;
      const job = pendingJobs.get(id);

      if (!job) return;

      if (type === 'progress') {
        console.log(`PDF parsing progress: ${progress.toFixed(1)}% (page ${currentPage}/${totalPages})`);
      } else if (type === 'complete') {
        job.resolve(texts);
        pendingJobs.delete(id);
      } else if (type === 'error') {
        job.reject(new Error(error));
        pendingJobs.delete(id);
      }
    };

    pdfWorker.onerror = (error) => {
      console.error('PDF Worker error:', error);
      pendingJobs.forEach(job => job.reject(new Error('PDF worker crashed')));
      pendingJobs.clear();
      pdfWorker = null;
    };
  }
  return pdfWorker;
}

export async function extractTextFromPDF(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const worker = getWorker();
  const id = ++jobCounter;

  return new Promise<string[]>((resolve, reject) => {
    // Set timeout for PDF processing (30 seconds per file)
    const timeout = setTimeout(() => {
      pendingJobs.delete(id);
      reject(new Error('PDF processing timeout - file may be too large or complex'));
    }, 30000);

    pendingJobs.set(id, { 
      resolve: (texts: string[]) => {
        clearTimeout(timeout);
        try {
          // Optimize PDF processing: chunk pages for better semantic grouping
          const optimizedTexts = chunkPDFPages(texts);
          resolve(optimizedTexts);
        } catch (err) {
          reject(new Error('Failed to process extracted PDF text'));
        }
      }, 
      reject: (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      }
    });
    
    worker.postMessage({ arrayBuffer, id });
  });
}

// Chunk PDF pages intelligently for academic papers
function chunkPDFPages(pages: string[]): string[] {
  const chunks: string[] = [];
  const chunkSize = 3; // Group 3 pages together for research papers
  
  // Detect if this looks like an academic paper (has abstract, introduction, etc.)
  const isAcademicPaper = pages.some(page => 
    /abstract|introduction|methodology|results|discussion|conclusion/i.test(page)
  );
  
  if (isAcademicPaper && pages.length > 6) {
    // For academic papers, group pages by sections
    for (let i = 0; i < pages.length; i += chunkSize) {
      const pageGroup = pages.slice(i, i + chunkSize);
      const combinedText = pageGroup.join('\n\n');
      chunks.push(combinedText);
    }
    return chunks;
  }
  
  // For other documents, return as-is
  return pages;
}
