-- Create table to track scrape metrics
CREATE TABLE public.scrape_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scrape_type TEXT NOT NULL DEFAULT 'reddit',
  time_range TEXT,
  sort_mode TEXT,
  fast_mode BOOLEAN DEFAULT false,
  subreddits_attempted INTEGER DEFAULT 0,
  subreddits_successful INTEGER DEFAULT 0,
  posts_collected INTEGER DEFAULT 0,
  comments_collected INTEGER DEFAULT 0,
  total_items INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  error_message TEXT
);

-- Enable RLS but allow public inserts (edge function doesn't auth)
ALTER TABLE public.scrape_metrics ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert metrics (edge function calls)
CREATE POLICY "Allow public insert" ON public.scrape_metrics
  FOR INSERT WITH CHECK (true);

-- Allow anyone to read metrics
CREATE POLICY "Allow public read" ON public.scrape_metrics
  FOR SELECT USING (true);