-- Create research_projects table
CREATE TABLE public.research_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create project_papers table
CREATE TABLE public.project_papers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  paper_data JSONB NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_research_projects_user_id ON public.research_projects(user_id);
CREATE INDEX idx_project_papers_project_id ON public.project_papers(project_id);

-- Enable Row Level Security
ALTER TABLE public.research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_papers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for research_projects
CREATE POLICY "Users can view their own projects"
  ON public.research_projects
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
  ON public.research_projects
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.research_projects
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON public.research_projects
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for project_papers
CREATE POLICY "Users can view papers in their projects"
  ON public.project_papers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.research_projects
      WHERE research_projects.id = project_papers.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add papers to their projects"
  ON public.project_papers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.research_projects
      WHERE research_projects.id = project_papers.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update papers in their projects"
  ON public.project_papers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.research_projects
      WHERE research_projects.id = project_papers.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete papers from their projects"
  ON public.project_papers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.research_projects
      WHERE research_projects.id = project_papers.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

-- Create trigger for updated_at on research_projects
CREATE TRIGGER update_research_projects_updated_at
  BEFORE UPDATE ON public.research_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();