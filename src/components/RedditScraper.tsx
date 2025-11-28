import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Radio, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  TrendingUp,
  MessageSquare,
  Calendar,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { RedditData } from '@/types/reddit';

const DEFAULT_SUBREDDITS = [
  'AskAcademia', 'GradSchool', 'PhD', 'science', 'AcademicPsychology',
  'labrats', 'Professors', 'scholarships', 'researchstudents', 'PostDoc',
  'OpenScience', 'MachineLearning', 'datascience', 'SciencePolicy', 'engineering',
  'AskScienceDiscussion', 'academia', 'ScientificComputing', 'artificial', 'deeplearning',
  'LanguageTechnology', 'computervision', 'reinforcementlearning', 'learnmachinelearning',
  'MLQuestions', 'LocalLLaMA', 'cscareerquestions', 'compsci', 'algorithms',
  'MachineLearningResearch', 'robotics', 'QuantumComputing', 'computerscience',
  'MLPapers', 'ControlProblem', 'AIethics', 'singularity', 'AGI', 'HCI'
];

type TimeRange = 'day' | '3days' | 'week' | 'month';

interface ScrapeSummary {
  totalPosts: number;
  totalComments: number;
  subredditsScraped: number;
  timeRange: string;
  subredditStats: Record<string, { posts: number; comments: number }>;
}

interface RedditScraperProps {
  onDataScraped: (data: RedditData[]) => void;
}

export function RedditScraper({ onDataScraped }: RedditScraperProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('day');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [lastScrape, setLastScrape] = useState<ScrapeSummary | null>(null);
  const [showSubreddits, setShowSubreddits] = useState(false);
  const [subreddits, setSubreddits] = useState<string[]>(DEFAULT_SUBREDDITS);
  const { toast } = useToast();

  const timeRangeOptions: { value: TimeRange; label: string; description: string }[] = [
    { value: 'day', label: 'Today', description: 'Last 24 hours' },
    { value: '3days', label: '3 Days', description: 'Past 3 days' },
    { value: 'week', label: '1 Week', description: 'Past 7 days' },
    { value: 'month', label: '1 Month', description: 'Past 30 days' },
  ];

  const handleScrape = async () => {
    setIsLoading(true);
    setProgress(0);
    setStatus('Initializing scraper...');

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      setStatus(`Scraping ${subreddits.length} subreddits...`);
      setProgress(10);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 85));
      }, 2000);

      const { data, error } = await supabase.functions.invoke('scrape-reddit-bulk', {
        body: {
          subreddits,
          timeRange: selectedTimeRange,
          postsPerSubreddit: 10,
          saveToDb: true
        }
      });

      clearInterval(progressInterval);

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Scrape failed');
      }

      setProgress(100);
      setStatus('Complete!');
      setLastScrape(data.summary);

      // Pass scraped data to parent
      if (data.data && data.data.length > 0) {
        onDataScraped(data.data);
        toast({
          title: 'Scrape Complete',
          description: `Collected ${data.summary.totalPosts} posts and ${data.summary.totalComments} comments from ${data.summary.subredditsScraped} subreddits.`,
        });
      } else {
        toast({
          title: 'No Data Found',
          description: 'No posts found for the selected time range.',
          variant: 'destructive',
        });
      }

    } catch (error) {
      console.error('Scrape error:', error);
      toast({
        title: 'Scrape Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        setProgress(0);
        setStatus('');
      }, 2000);
    }
  };

  const toggleSubreddit = (sub: string) => {
    setSubreddits(prev => 
      prev.includes(sub) 
        ? prev.filter(s => s !== sub)
        : [...prev, sub]
    );
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 rounded-lg">
            <Radio className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Reddit Sentiment Scraper</h3>
            <p className="text-sm text-muted-foreground">
              Scrape top posts from {subreddits.length} research subreddits
            </p>
          </div>
        </div>
      </div>

      {/* Time Range Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Time Range</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {timeRangeOptions.map((option) => (
            <Button
              key={option.value}
              variant={selectedTimeRange === option.value ? 'default' : 'outline'}
              className="flex flex-col h-auto py-3"
              onClick={() => setSelectedTimeRange(option.value)}
              disabled={isLoading}
            >
              <span className="font-semibold">{option.label}</span>
              <span className="text-xs opacity-70">{option.description}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Subreddit List (Collapsible) */}
      <Collapsible open={showSubreddits} onOpenChange={setShowSubreddits}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Subreddits ({subreddits.length} selected)
            </span>
            {showSubreddits ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <ScrollArea className="h-[200px] border rounded-lg p-3">
            <div className="flex flex-wrap gap-2">
              {DEFAULT_SUBREDDITS.map((sub) => (
                <Badge
                  key={sub}
                  variant={subreddits.includes(sub) ? 'default' : 'outline'}
                  className="cursor-pointer transition-all hover:scale-105"
                  onClick={() => toggleSubreddit(sub)}
                >
                  r/{sub}
                </Badge>
              ))}
            </div>
          </ScrollArea>
          <div className="flex gap-2 mt-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSubreddits(DEFAULT_SUBREDDITS)}
            >
              Select All
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSubreddits([])}
            >
              Clear All
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Progress */}
      {isLoading && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center">{status}</p>
        </div>
      )}

      {/* Scrape Button */}
      <Button
        className="w-full h-12 text-lg"
        onClick={handleScrape}
        disabled={isLoading || subreddits.length === 0}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Scraping Reddit...
          </>
        ) : (
          <>
            <TrendingUp className="w-5 h-5 mr-2" />
            Scrape {selectedTimeRange === 'day' ? "Today's" : timeRangeOptions.find(o => o.value === selectedTimeRange)?.label} Sentiment
          </>
        )}
      </Button>

      {/* Last Scrape Summary */}
      {lastScrape && (
        <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Last Scrape Summary
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{lastScrape.totalPosts}</p>
              <p className="text-xs text-muted-foreground">Posts</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{lastScrape.totalComments}</p>
              <p className="text-xs text-muted-foreground">Comments</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{lastScrape.subredditsScraped}</p>
              <p className="text-xs text-muted-foreground">Subreddits</p>
            </div>
          </div>
          
          {/* Top Subreddits by Activity */}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Top Active Subreddits</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(lastScrape.subredditStats)
                .sort((a, b) => (b[1].posts + b[1].comments) - (a[1].posts + a[1].comments))
                .slice(0, 5)
                .map(([sub, stats]) => (
                  <Badge key={sub} variant="secondary" className="text-xs">
                    r/{sub} ({stats.posts + stats.comments})
                  </Badge>
                ))}
            </div>
          </div>
        </div>
      )}

      {subreddits.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-500/10 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4" />
          Select at least one subreddit to scrape
        </div>
      )}
    </Card>
  );
}
