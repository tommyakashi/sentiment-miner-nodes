import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useScrapeHistory } from '@/hooks/useScrapeHistory';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Radio,
  Loader2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Flame,
  ArrowUpRight,
  Zap,
  Clock,
  CircleDot,
  ArrowLeft,
  CalendarIcon,
  Play,
} from 'lucide-react';
import type { RedditData } from '@/types/reddit';
import type { Node } from '@/types/sentiment';

// AI-specific subreddits (content always kept)
const AI_SPECIFIC_SUBREDDITS = [
  'MachineLearning', 'datascience', 'artificial', 'deeplearning',
  'LanguageTechnology', 'computervision', 'reinforcementlearning',
  'learnmachinelearning', 'MLQuestions', 'LocalLLaMA', 'LocalLLM',
  'MachineLearningResearch', 'MLPapers', 'ControlProblem', 'AIethics',
  'singularity', 'AGI', 'StableDiffusion', 'AI_Agents', 'aiengineering'
];

// General subreddits (content filtered for AI-relevance)
const GENERAL_SUBREDDITS = [
  'AskAcademia', 'GradSchool', 'PhD', 'science', 'AcademicPsychology',
  'labrats', 'Professors', 'scholarships', 'researchstudents', 'PostDoc',
  'OpenScience', 'SciencePolicy', 'engineering', 'AskScienceDiscussion',
  'academia', 'ScientificComputing', 'cscareerquestions', 'compsci',
  'algorithms', 'robotics', 'QuantumComputing', 'computerscience', 'HCI'
];

const FAST_MODE_SUBREDDITS = [
  ...AI_SPECIFIC_SUBREDDITS.slice(0, 12),
  'cscareerquestions', 'compsci', 'robotics'
];

const ALL_SUBREDDITS = [...AI_SPECIFIC_SUBREDDITS, ...GENERAL_SUBREDDITS];

type TimeRange = 'day' | '3days' | 'week' | 'month' | 'custom';
type SortMode = 'top' | 'hot' | 'rising';

interface RedditScraperSimplifiedProps {
  nodes: Node[];
  onScrapeAndAnalyze: (data: RedditData[]) => void;
  onBack: () => void;
}

export function RedditScraperSimplified({ nodes, onScrapeAndAnalyze, onBack }: RedditScraperSimplifiedProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('day');
  const [selectedSortMode, setSelectedSortMode] = useState<SortMode>('top');
  const [progress, setProgress] = useState(0);
  const [currentBatch, setCurrentBatch] = useState<string[]>([]);
  const [completedSubreddits, setCompletedSubreddits] = useState<string[]>([]);
  const [fastMode, setFastMode] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date;
  });
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const startTimeRef = useRef<number>(0);
  const { toast } = useToast();
  const { addScrape } = useScrapeHistory();

  const activeSubreddits = fastMode ? FAST_MODE_SUBREDDITS : ALL_SUBREDDITS;

  const timeRangeOptions: { value: TimeRange; label: string; description: string }[] = [
    { value: 'day', label: 'Today', description: 'Last 24 hours' },
    { value: '3days', label: '3 Days', description: 'Past 3 days' },
    { value: 'week', label: '1 Week', description: 'Past 7 days' },
    { value: 'month', label: '1 Month', description: 'Past 30 days' },
    { value: 'custom', label: 'Custom', description: 'Select dates' },
  ];

  const sortModeOptions: { value: SortMode; label: string; icon: React.ReactNode }[] = [
    { value: 'top', label: 'Top', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { value: 'hot', label: 'Hot', icon: <Flame className="w-3.5 h-3.5" /> },
    { value: 'rising', label: 'Rising', icon: <ArrowUpRight className="w-3.5 h-3.5" /> },
  ];

  // Progress simulation
  useEffect(() => {
    if (!isLoading) return;

    const BATCH_SIZE = 3;
    const TIME_PER_BATCH_MS = 3000;
    const totalBatches = Math.ceil(activeSubreddits.length / BATCH_SIZE);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setElapsedTime(Math.floor(elapsed / 1000));

      const currentBatchIndex = Math.min(
        Math.floor(elapsed / TIME_PER_BATCH_MS),
        totalBatches - 1
      );

      const batchStart = currentBatchIndex * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, activeSubreddits.length);
      setCurrentBatch(activeSubreddits.slice(batchStart, batchEnd));
      setCompletedSubreddits(activeSubreddits.slice(0, batchStart));

      const progressPercent = Math.min(((currentBatchIndex + 0.5) / totalBatches) * 95, 95);
      setProgress(progressPercent);
    }, 200);

    return () => clearInterval(interval);
  }, [isLoading, activeSubreddits]);

  const handleScrapeAndAnalyze = async () => {
    setIsLoading(true);
    setProgress(0);
    setCurrentBatch([]);
    setCompletedSubreddits([]);
    setElapsedTime(0);
    startTimeRef.current = Date.now();

    try {
      const { data, error } = await supabase.functions.invoke('scrape-reddit-bulk', {
        body: {
          subreddits: undefined,
          timeRange: selectedTimeRange === 'custom' ? 'month' : selectedTimeRange,
          sortMode: selectedSortMode,
          postsPerSubreddit: 25,
          saveToDb: false,
          fastMode: fastMode
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Scrape failed');

      setProgress(100);
      setCompletedSubreddits(activeSubreddits);
      setCurrentBatch([]);

      if (data.data && data.data.length > 0) {
        // Save to history
        const posts = data.data.filter((d: any) => d.dataType === 'post');
        const comments = data.data.filter((d: any) => d.dataType === 'comment');
        addScrape({
          name: `Reddit Scrape - ${selectedTimeRange}`,
          item_count: data.data.length,
          content: {
            posts,
            comments,
            subredditStats: data.summary.subredditStats,
            timeRange: selectedTimeRange,
            sortMode: selectedSortMode,
            scrapedAt: new Date().toISOString(),
            totalSubreddits: data.summary.subredditsScraped,
            fastMode,
          }
        });

        toast({
          title: 'Scrape Complete',
          description: `Found ${data.summary.totalPosts} posts and ${data.summary.totalComments} comments. Starting analysis...`,
        });

        // Trigger analysis
        onScrapeAndAnalyze(data.data);
      } else {
        toast({
          title: 'No Data Found',
          description: 'No posts found for the selected time range.',
          variant: 'destructive',
        });
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Scrape error:', error);
      toast({
        title: 'Scrape Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 py-8">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Radio className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Reddit Scanner</h2>
            <p className="text-sm text-muted-foreground font-mono">
              {nodes.length} nodes • {activeSubreddits.length} subreddits
            </p>
          </div>
        </div>
      </div>

      {/* Config Card */}
      <Card className="p-6 space-y-6 bg-card/60 backdrop-blur-sm border-border/50">
        {/* Mode Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Scan Mode</label>
          <button
            onClick={() => !isLoading && setFastMode(!fastMode)}
            disabled={isLoading}
            className={cn(
              "px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wider border transition-all",
              fastMode
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-400',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full animate-pulse", fastMode ? 'bg-amber-400' : 'bg-blue-400')} />
              <span>{fastMode ? 'FAST' : 'FULL'}</span>
            </div>
          </button>
        </div>

        {/* Sort Mode */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Sort By</label>
          <div className="flex gap-2">
            {sortModeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedSortMode(option.value)}
                disabled={isLoading}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                  selectedSortMode === option.value
                    ? 'bg-primary/10 border-primary/30 text-foreground'
                    : 'bg-background/30 border-border/50 text-muted-foreground hover:text-foreground',
                  isLoading && 'opacity-50 cursor-not-allowed'
                )}
              >
                {option.icon}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Time Range */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Time Range</label>
          <div className="grid grid-cols-5 gap-2">
            {timeRangeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedTimeRange(option.value)}
                disabled={isLoading}
                className={cn(
                  "flex flex-col items-center py-3 px-2 rounded-lg border text-sm transition-all",
                  selectedTimeRange === option.value
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-background/30 border-border/50 hover:border-border',
                  isLoading && 'opacity-50 cursor-not-allowed'
                )}
              >
                <span className="font-semibold text-foreground">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range */}
        {selectedTimeRange === 'custom' && (
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 justify-start font-mono bg-background/30" disabled={isLoading}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(customStartDate, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customStartDate}
                  onSelect={(date) => date && setCustomStartDate(date)}
                  disabled={(date) => date > customEndDate || date > new Date()}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 justify-start font-mono bg-background/30" disabled={isLoading}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(customEndDate, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customEndDate}
                  onSelect={(date) => date && setCustomEndDate(date)}
                  disabled={(date) => date < customStartDate || date > new Date()}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Action Button */}
        <Button
          className="w-full h-14 text-lg gap-3"
          onClick={handleScrapeAndAnalyze}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Scraping & Analyzing...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Scrape & Analyze
            </>
          )}
        </Button>

        {/* Collapsible Progress */}
        {isLoading && (
          <Collapsible open={showProgress} onOpenChange={setShowProgress}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between p-3 rounded-lg bg-background/30 border border-border/50 text-sm">
                <div className="flex items-center gap-3">
                  <CircleDot className="w-4 h-4 text-orange-400 animate-pulse" />
                  <span className="font-mono">
                    {completedSubreddits.length}/{activeSubreddits.length} subreddits • {elapsedTime}s
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Show Progress</span>
                  {showProgress ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 p-4 rounded-lg bg-background/30 border border-border/50 space-y-3">
                <Progress value={progress} className="h-1.5" />
                {currentBatch.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {currentBatch.map((sub) => (
                      <Badge
                        key={sub}
                        variant="outline"
                        className="text-xs animate-pulse border-orange-500/30 text-orange-400 bg-orange-500/10"
                      >
                        r/{sub}
                      </Badge>
                    ))}
                  </div>
                )}
                {completedSubreddits.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {completedSubreddits.slice(-10).map((sub) => (
                      <Badge key={sub} variant="secondary" className="text-xs opacity-60">
                        r/{sub} ✓
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </Card>
    </div>
  );
}
