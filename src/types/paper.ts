export interface SemanticScholarAuthor {
  authorId: string;
  name: string;
}

export interface AcademicPaper {
  id: string;
  paperId: string;
  title: string;
  abstract: string;
  tldr?: string;
  authors: SemanticScholarAuthor[];
  year: number;
  venue?: string;
  citationCount: number;
  influentialCitationCount?: number;
  fieldsOfStudy?: string[];
  publicationDate?: string;
  url: string;
  combinedText: string;
  createdAt: Date;
  dataType: 'paper';
  importanceScore?: number;
}

export interface PaperScrapeRecord {
  id: string;
  keywords: string[];
  author_query?: string;
  year_min?: number;
  year_max?: number;
  domains?: string[];
  total_papers: number;
  papers: AcademicPaper[];
  created_at: string;
}

export interface PaperSearchParams {
  keywords?: string[];
  authorQuery?: string;
  yearMin?: number;
  yearMax?: number;
  domains?: string[];
  limit?: number;
}
