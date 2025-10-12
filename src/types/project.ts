import { ResearchPaper } from './consensus';

export interface ResearchProject {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectPaper {
  id: string;
  project_id: string;
  paper_data: ResearchPaper;
  added_at: Date;
}

export interface ProjectWithPapers extends ResearchProject {
  papers: ProjectPaper[];
  paper_count: number;
}
