import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
const workerUrl = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

self.onmessage = async (e: MessageEvent) => {
  const { arrayBuffer, id } = e.data;

  try {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const texts: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .trim();
      
      if (pageText.length > 0) {
        texts.push(pageText);
      }

      // Send progress updates
      self.postMessage({
        type: 'progress',
        id,
        progress: (pageNum / pdf.numPages) * 100,
        currentPage: pageNum,
        totalPages: pdf.numPages
      });
    }

    self.postMessage({
      type: 'complete',
      id,
      texts
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      id,
      error: error instanceof Error ? error.message : 'Failed to parse PDF'
    });
  }
};
