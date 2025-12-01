-- Create table for storing academic paper scrapes
CREATE TABLE public.paper_scrapes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  keywords TEXT[],
  author_query TEXT,
  year_min INTEGER,
  year_max INTEGER,
  domains TEXT[],
  total_papers INTEGER DEFAULT 0,
  papers JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.paper_scrapes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own paper scrapes" 
ON public.paper_scrapes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own paper scrapes" 
ON public.paper_scrapes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own paper scrapes" 
ON public.paper_scrapes 
FOR DELETE 
USING (auth.uid() = user_id);