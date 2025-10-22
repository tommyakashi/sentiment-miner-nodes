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
    pendingJobs.set(id, { resolve, reject });
    worker.postMessage({ arrayBuffer, id });
  });
}
