export interface ResearchPaper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  journal?: string;
  abstract: string;
  fullText?: string;
  citations?: number;
  url?: string;
  pdfFile?: File;
  uploadedAt: Date;
  studyType?: string;
  domain?: string;
  selected: boolean;
}

export interface ResearchFilters {
  yearMin: number;
  yearMax: number;
  studyTypes: string[];
  domains: string[];
  searchQuery: string;
}

export const STUDY_TYPES = [
  'Meta-Analysis',
  'Systematic Review',
  'RCT',
  'Observational',
  'Case Study',
  'Literature Review',
  'Other'
];

export const DOMAINS = [
  'Computer Science',
  'Psychology',
  'Medicine',
  'Biology',
  'Economics',
  'Education',
  'Engineering',
  'Other'
];
