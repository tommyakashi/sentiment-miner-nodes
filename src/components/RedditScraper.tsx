import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useScrapeHistory } from '@/hooks/useScrapeHistory';
import { supabase } from '@/integrations/supabase/client';
import { 
  Radio, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  TrendingUp,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Zap,
  Clock,
  CircleDot,
  Flame,
  ArrowUpRight
} from 'lucide-react';
import type { RedditData } from '@/types/reddit';

// Core high-activity subreddits for fast mode
const FAST_MODE_SUBREDDITS = [
  'AskAcademia', 'GradSchool', 'PhD', 'science', 'MachineLearning',
  'datascience', 'LocalLLaMA', 'LocalLLM', 'cscareerquestions', 'labrats', 'Professors',
  'singularity', 'AGI', 'artificial', 'deeplearning', 'compsci', 'StableDiffusion',
  'AI_Agents', 'aiengineering'
];

// Full list for comprehensive analysis
const ALL_SUBREDDITS = [
  'AskAcademia', 'GradSchool', 'PhD', 'science', 'AcademicPsychology',
  'labrats', 'Professors', 'scholarships', 'researchstudents', 'PostDoc',
  'OpenScience', 'MachineLearning', 'datascience', 'SciencePolicy', 'engineering',
  'AskScienceDiscussion', 'academia', 'ScientificComputing', 'artificial', 'deeplearning',
  'LanguageTechnology', 'computervision', 'reinforcementlearning', 'learnmachinelearning',
  'MLQuestions', 'LocalLLaMA', 'LocalLLM', 'cscareerquestions', 'compsci', 'algorithms',
  'MachineLearningResearch', 'robotics', 'QuantumComputing', 'computerscience',
  'MLPapers', 'ControlProblem', 'AIethics', 'singularity', 'AGI', 'HCI',
  'StableDiffusion', 'AI_Agents', 'aiengineering'
];

type TimeRange = 'day' | '3days' | 'week' | 'month';
type SortMode = 'top' | 'hot' | 'rising';

interface ScrapeSummary {
  totalPosts: number;
  totalComments: number;
  subredditsScraped: number;
  subredditsRequested?: number;
  failedSubreddits?: number;
  timeRange: string;
  sortMode?: string;
  fastMode?: boolean;
  avgUpvotes?: number;
  postsWithEngagement?: number;
  methodStats?: { oauth: number; json: number; rss: number; arctic: number; failed: number };
  subredditStats: Record<string, { posts: number; comments: number }>;
}

interface RedditScraperProps {
  onDataScraped: (data: RedditData[]) => void;
}

export function RedditScraper({ onDataScraped }: RedditScraperProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('day');
  const [selectedSortMode, setSelectedSortMode] = useState<SortMode>('top');
  const [progress, setProgress] = useState(0);
  const [currentBatch, setCurrentBatch] = useState<string[]>([]);
  const [completedSubreddits, setCompletedSubreddits] = useState<string[]>([]);
  const [lastScrape, setLastScrape] = useState<ScrapeSummary | null>(null);
  const [showSubreddits, setShowSubreddits] = useState(false);
  const [fastMode, setFastMode] = useState(true);
  const [customSubreddits, setCustomSubreddits] = useState<string[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const startTimeRef = useRef<number>(0);
  const { toast } = useToast();
  const { addScrape } = useScrapeHistory();

  const activeSubreddits = customSubreddits.length > 0 
    ? customSubreddits 
    : (fastMode ? FAST_MODE_SUBREDDITS : ALL_SUBREDDITS);

  const timeRangeOptions: { value: TimeRange; label: string; description: string }[] = [
    { value: 'day', label: 'Today', description: 'Last 24 hours' },
    { value: '3days', label: '3 Days', description: 'Past 3 days' },
    { value: 'week', label: '1 Week', description: 'Past 7 days' },
    { value: 'month', label: '1 Month', description: 'Past 30 days' },
  ];

  const sortModeOptions: { value: SortMode; label: string; icon: React.ReactNode; description: string }[] = [
    { value: 'top', label: 'Top', icon: <TrendingUp className="w-3.5 h-3.5" />, description: 'Most upvoted' },
    { value: 'hot', label: 'Hot', icon: <Flame className="w-3.5 h-3.5" />, description: 'Trending now' },
    { value: 'rising', label: 'Rising', icon: <ArrowUpRight className="w-3.5 h-3.5" />, description: 'Gaining momentum' },
  ];

  // Simulate real-time progress based on known batch timing
  useEffect(() => {
    if (!isLoading) return;

    const BATCH_SIZE = 3;
    const TIME_PER_BATCH_MS = 3000; // ~3s per batch with OAuth
    const totalBatches = Math.ceil(activeSubreddits.length / BATCH_SIZE);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setElapsedTime(Math.floor(elapsed / 1000));
      
      // Calculate current batch based on elapsed time
      const currentBatchIndex = Math.min(
        Math.floor(elapsed / TIME_PER_BATCH_MS),
        totalBatches - 1
      );
      
      // Get current batch subreddits
      const batchStart = currentBatchIndex * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, activeSubreddits.length);
      const currentBatchSubs = activeSubreddits.slice(batchStart, batchEnd);
      setCurrentBatch(currentBatchSubs);
      
      // Mark completed subreddits
      const completed = activeSubreddits.slice(0, batchStart);
      setCompletedSubreddits(completed);
      
      // Calculate progress
      const progressPercent = Math.min(
        ((currentBatchIndex + 0.5) / totalBatches) * 95,
        95
      );
      setProgress(progressPercent);
    }, 200);

    return () => clearInterval(interval);
  }, [isLoading, activeSubreddits]);

  const handleScrape = async () => {
    setIsLoading(true);
    setProgress(0);
    setCurrentBatch([]);
    setCompletedSubreddits([]);
    setElapsedTime(0);
    startTimeRef.current = Date.now();

    try {
      const { data, error } = await supabase.functions.invoke('scrape-reddit-bulk', {
        body: {
          subreddits: customSubreddits.length > 0 ? customSubreddits : undefined,
          timeRange: selectedTimeRange,
          sortMode: selectedSortMode,
          postsPerSubreddit: 25,
          saveToDb: false,
          fastMode: customSubreddits.length === 0 ? fastMode : false
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Scrape failed');

      setProgress(100);
      setCompletedSubreddits(activeSubreddits);
      setCurrentBatch([]);
      setLastScrape(data.summary);

      if (data.data && data.data.length > 0) {
        onDataScraped(data.data);
        
        // Save to localStorage
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
            fastMode: customSubreddits.length === 0 ? fastMode : false,
          }
        });
        
        const hasPartialData = data.summary.failedSubreddits > 0;
        const avgUpvotes = data.summary.avgUpvotes || 0;
        toast({
          title: hasPartialData ? 'Scrape Complete (Partial)' : 'Scrape Complete',
          description: `${data.summary.totalPosts} posts (avg ${avgUpvotes} upvotes), ${data.summary.totalComments} comments from ${data.summary.subredditsScraped} subreddits.`,
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
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        setProgress(0);
        setCurrentBatch([]);
        setCompletedSubreddits([]);
      }, 3000);
    }
  };

  const toggleSubreddit = (sub: string) => {
    setCustomSubreddits(prev => 
      prev.includes(sub) 
        ? prev.filter(s => s !== sub)
        : [...prev, sub]
    );
  };

  const resetToDefault = () => {
    setCustomSubreddits([]);
  };

  return (
    <Card className="p-6 space-y-6 bg-card/60 backdrop-blur-sm border-border/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Radio className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Reddit Signal Scanner</h3>
            <p className="text-sm text-muted-foreground font-mono">
              {activeSubreddits.length} research communities
            </p>
          </div>
        </div>

        {/* Mode Toggle */}
        <button
          onClick={() => {
            if (!isLoading && customSubreddits.length === 0) {
              setFastMode(!fastMode);
              setCustomSubreddits([]);
            }
          }}
          disabled={isLoading || customSubreddits.length > 0}
          className={`
            relative px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wider
            border transition-all duration-300
            ${fastMode 
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
              : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
            }
            ${isLoading || customSubreddits.length > 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-20 cursor-pointer'}
          `}
        >
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full animate-pulse ${fastMode ? 'bg-amber-400' : 'bg-blue-400'}`} />
            <span className="text-[10px] text-muted-foreground">MODE</span>
            <span>{fastMode ? 'FAST' : 'FULL'}</span>
          </div>
        </button>
      </div>

      {/* Mode details */}
      <div className={`text-xs px-3 py-2 rounded-lg inline-flex items-center gap-2 border ${fastMode ? 'bg-amber-500/5 border-amber-500/20 text-amber-400' : 'bg-blue-500/5 border-blue-500/20 text-blue-400'}`}>
        {fastMode ? (
          <>
            <Zap className="w-3.5 h-3.5" />
            <span className="font-mono">19 core subreddits • ~20s scan time</span>
          </>
        ) : (
          <>
            <Clock className="w-3.5 h-3.5" />
            <span className="font-mono">42 subreddits • ~60s comprehensive scan</span>
          </>
        )}
      </div>

      {/* Sort Mode Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Sort By</label>
        <div className="flex gap-2">
          {sortModeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedSortMode(option.value)}
              disabled={isLoading}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all
                ${selectedSortMode === option.value 
                  ? 'bg-primary/10 border-primary/30 text-foreground' 
                  : 'bg-background/30 border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground font-mono">
          {sortModeOptions.find(o => o.value === selectedSortMode)?.description}
          {selectedSortMode === 'top' && ' for the selected time range'}
        </p>
      </div>

      {/* Time Range Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">
          Time Range {selectedSortMode !== 'top' && <span className="text-muted-foreground font-normal">(filter only)</span>}
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {timeRangeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedTimeRange(option.value)}
              disabled={isLoading}
              className={`
                flex flex-col items-center py-3 px-4 rounded-lg border text-sm transition-all
                ${selectedTimeRange === option.value 
                  ? 'bg-primary/10 border-primary/30' 
                  : 'bg-background/30 border-border/50 hover:border-border'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <span className="font-semibold text-foreground">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Subreddit List (Collapsible) */}
      <Collapsible open={showSubreddits} onOpenChange={setShowSubreddits}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Customize Subreddits ({activeSubreddits.length} active)
            </span>
            {showSubreddits ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <ScrollArea className="h-[200px] border rounded-lg p-3">
            <div className="flex flex-wrap gap-2">
              {ALL_SUBREDDITS.map((sub) => {
                const isActive = customSubreddits.length > 0 
                  ? customSubreddits.includes(sub)
                  : activeSubreddits.includes(sub);
                const isFastCore = FAST_MODE_SUBREDDITS.includes(sub);
                
                return (
                  <Badge
                    key={sub}
                    variant={isActive ? 'default' : 'outline'}
                    className={`cursor-pointer transition-all hover:scale-105 ${isFastCore && customSubreddits.length === 0 ? 'ring-1 ring-amber-500/50' : ''}`}
                    onClick={() => toggleSubreddit(sub)}
                  >
                    r/{sub}
                  </Badge>
                );
              })}
            </div>
          </ScrollArea>
          <div className="flex gap-2 mt-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCustomSubreddits([...ALL_SUBREDDITS])}
            >
              Select All
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCustomSubreddits([])}
            >
              Clear
            </Button>
            {customSubreddits.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={resetToDefault}
              >
                Reset to {fastMode ? 'Fast' : 'Full'} Mode
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Real-time Progress */}
      {isLoading && (
        <div className="space-y-4 p-4 rounded-lg border border-border/50 bg-background/30">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-mono">
              Processing {completedSubreddits.length + currentBatch.length} / {activeSubreddits.length}
            </span>
            <span className="font-mono text-foreground">{elapsedTime}s</span>
          </div>
          
          <Progress value={progress} className="h-1.5" />
          
          {/* Current batch indicator */}
          {currentBatch.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CircleDot className="w-3 h-3 text-orange-400 animate-pulse" />
                <span className="font-mono">SCANNING</span>
              </div>
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
            </div>
          )}
          
          {/* Completed subreddits */}
          {completedSubreddits.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {completedSubreddits.slice(-8).map((sub) => (
                <Badge 
                  key={sub} 
                  variant="outline" 
                  className="text-xs border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                >
                  <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                  {sub}
                </Badge>
              ))}
              {completedSubreddits.length > 8 && (
                <Badge variant="outline" className="text-xs text-muted-foreground border-border/50">
                  +{completedSubreddits.length - 8} more
                </Badge>
              )}
            </div>
          )}
        </div>
      )}

      {/* Scrape Button */}
      <Button
        className="w-full h-12 text-lg"
        onClick={handleScrape}
        disabled={isLoading || activeSubreddits.length === 0}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Scanning...
          </>
        ) : (
          <>
            {selectedSortMode === 'top' && <TrendingUp className="w-5 h-5 mr-2" />}
            {selectedSortMode === 'hot' && <Flame className="w-5 h-5 mr-2" />}
            {selectedSortMode === 'rising' && <ArrowUpRight className="w-5 h-5 mr-2" />}
            Scan {sortModeOptions.find(o => o.value === selectedSortMode)?.label} {timeRangeOptions.find(o => o.value === selectedTimeRange)?.label}
          </>
        )}
      </Button>

      {/* Last Scrape Summary */}
      {lastScrape && !isLoading && (
        <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Last Scrape Summary
            {lastScrape.fastMode !== undefined && (
              <Badge variant="outline" className="text-xs">
                {lastScrape.fastMode ? 'Fast' : 'Full'}
              </Badge>
            )}
            {lastScrape.sortMode && (
              <Badge variant="outline" className="text-xs capitalize">
                {lastScrape.sortMode}
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-4 gap-4 text-center">
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
            <div>
              <p className="text-2xl font-bold">{lastScrape.avgUpvotes || 0}</p>
              <p className="text-xs text-muted-foreground">Avg Upvotes</p>
            </div>
          </div>

          {/* Method Stats */}
          {lastScrape.methodStats && (
            <div className="flex gap-2 flex-wrap pt-2 border-t">
              {lastScrape.methodStats.oauth > 0 && (
                <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-600">
                  OAuth: {lastScrape.methodStats.oauth}
                </Badge>
              )}
              {lastScrape.methodStats.json > 0 && (
                <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-600">
                  JSON: {lastScrape.methodStats.json}
                </Badge>
              )}
              {lastScrape.methodStats.rss > 0 && (
                <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-600">
                  RSS: {lastScrape.methodStats.rss}
                </Badge>
              )}
              {lastScrape.methodStats.arctic > 0 && (
                <Badge variant="secondary" className="text-xs bg-purple-500/20 text-purple-600">
                  Arctic: {lastScrape.methodStats.arctic}
                </Badge>
              )}
              {lastScrape.methodStats.failed > 0 && (
                <Badge variant="secondary" className="text-xs bg-red-500/20 text-red-600">
                  Failed: {lastScrape.methodStats.failed}
                </Badge>
              )}
            </div>
          )}
          
          {/* Top Subreddits */}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Top Active</p>
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

      {activeSubreddits.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-500/10 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4" />
          Select at least one subreddit
        </div>
      )}
    </Card>
  );
}
