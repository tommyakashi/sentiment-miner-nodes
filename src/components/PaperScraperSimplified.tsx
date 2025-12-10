import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { usePaperHistory } from '@/hooks/usePaperHistory';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  BookOpen,
  Loader2,
  ChevronDown,
  ChevronUp,
  User,
  Target,
  Sparkles,
  CalendarIcon,
  ArrowLeft,
  Play,
} from 'lucide-react';
import type { AcademicPaper } from '@/types/paper';
import type { Node } from '@/types/sentiment';

interface PaperScraperSimplifiedProps {
  nodes: Node[];
  onScrapeAndAnalyze: (data: AcademicPaper[]) => void;
  onBack: () => void;
}

type SearchMode = 'nodes' | 'author' | 'combined';

export function PaperScraperSimplified({ nodes, onScrapeAndAnalyze, onBack }: PaperScraperSimplifiedProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>('nodes');
  const [authorQuery, setAuthorQuery] = useState('');
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(nodes.map(n => n.id));
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 2);
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const startTimeRef = useRef<number>(0);
  const { toast } = useToast();
  const { addScrape } = usePaperHistory();

  // Get search topics based on selected nodes
  const getSearchTopics = () => {
    const topics: string[] = [];
    nodes
      .filter(n => selectedNodeIds.includes(n.id))
      .forEach(node => {
        topics.push(node.name);
        if (node.keywords.length > 0) {
          topics.push(...node.keywords.slice(0, 3));
        }
      });
    return [...new Set(topics)];
  };

  const activeTopics = getSearchTopics();

  // Progress simulation
  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setElapsedTime(Math.floor(elapsed / 1000));

      const estimatedTopics = searchMode === 'author' ? 1 : Math.min(activeTopics.length, 10);
      const timePerTopic = 2000;
      const expectedTime = estimatedTopics * timePerTopic;
      const progressPercent = Math.min((elapsed / expectedTime) * 90, 90);
      setProgress(progressPercent);
    }, 200);

    return () => clearInterval(interval);
  }, [isLoading, activeTopics.length, searchMode]);

  const toggleNode = (nodeId: string) => {
    setSelectedNodeIds(prev =>
      prev.includes(nodeId)
        ? prev.filter(id => id !== nodeId)
        : [...prev, nodeId]
    );
  };

  const handleScrapeAndAnalyze = async () => {
    if (searchMode !== 'author' && activeTopics.length === 0) {
      toast({
        title: 'No topics selected',
        description: 'Select at least one node topic.',
        variant: 'destructive',
      });
      return;
    }

    if ((searchMode === 'author' || searchMode === 'combined') && !authorQuery.trim()) {
      toast({
        title: 'No author specified',
        description: 'Enter an author name to search.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setElapsedTime(0);
    startTimeRef.current = Date.now();

    try {
      const searchTopics = searchMode === 'author' ? [] : activeTopics.slice(0, 10);
      const searchAuthor = searchMode === 'nodes' ? undefined : authorQuery.trim();

      const { data, error } = await supabase.functions.invoke('scrape-papers', {
        body: {
          keywords: searchTopics,
          authorQuery: searchAuthor,
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
          limit: 100,
          saveToDb: false,
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Scrape failed');

      setProgress(100);

      if (data.data && data.data.length > 0) {
        // Save to history
        addScrape({
          keywords: searchTopics,
          author_query: searchAuthor || null,
          year_min: startDate.getFullYear(),
          year_max: endDate.getFullYear(),
          domains: null,
          total_papers: data.summary.totalPapers,
          papers: data.data,
        });

        toast({
          title: 'Scrape Complete',
          description: `Found ${data.summary.totalPapers} papers. Starting analysis...`,
        });

        // Trigger analysis
        onScrapeAndAnalyze(data.data);
      } else {
        toast({
          title: 'No Papers Found',
          description: 'Try different topics or expand the date range.',
          variant: 'destructive',
        });
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Paper scrape error:', error);
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
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Academic Scanner</h2>
            <p className="text-sm text-muted-foreground font-mono">
              {nodes.length} nodes • Semantic Scholar + arXiv
            </p>
          </div>
        </div>
      </div>

      {/* Config Card */}
      <Card className="p-6 space-y-6 bg-card/60 backdrop-blur-sm border-border/50">
        {/* Search Mode */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Search Mode</label>
          <div className="flex gap-2">
            {[
              { id: 'nodes', label: 'By Topics', icon: Target },
              { id: 'author', label: 'By Author', icon: User },
              { id: 'combined', label: 'Combined', icon: Sparkles },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSearchMode(id as SearchMode)}
                disabled={isLoading}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border",
                  searchMode === id
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                    : "bg-background/30 border-border/50 text-muted-foreground hover:border-border hover:text-foreground",
                  isLoading && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Author Input */}
        {(searchMode === 'author' || searchMode === 'combined') && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Author Name</label>
            <Input
              placeholder="e.g., Yoshua Bengio, Geoffrey Hinton"
              value={authorQuery}
              onChange={(e) => setAuthorQuery(e.target.value)}
              disabled={isLoading}
              className="bg-background/30 border-border/50"
            />
          </div>
        )}

        {/* Date Range */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Publication Window</label>
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1 justify-start font-mono bg-background/30 border-border/50"
                  disabled={isLoading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-blue-400" />
                  {format(startDate, "MMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  disabled={(date) => date > endDate || date > new Date()}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <div className="w-8 h-px bg-border/50" />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1 justify-start font-mono bg-background/30 border-border/50"
                  disabled={isLoading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-blue-400" />
                  {format(endDate, "MMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => date && setEndDate(date)}
                  disabled={(date) => date < startDate || date > new Date()}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Node Topics Selection */}
        {(searchMode === 'nodes' || searchMode === 'combined') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Research Topics</label>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-blue-400">
                  {selectedNodeIds.length}/{nodes.length}
                </span>
                <button
                  onClick={() => setSelectedNodeIds(nodes.map(n => n.id))}
                  disabled={isLoading}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedNodeIds([])}
                  disabled={isLoading}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  None
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {nodes.map((node) => {
                const isSelected = selectedNodeIds.includes(node.id);
                return (
                  <button
                    key={node.id}
                    onClick={() => !isLoading && toggleNode(node.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                      isSelected
                        ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                        : "bg-background/30 border-border/50 text-muted-foreground hover:border-border hover:text-foreground",
                      isLoading && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {node.name}
                  </button>
                );
              })}
            </div>
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
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  <span className="font-mono">
                    Searching {activeTopics.length} topics • {elapsedTime}s
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
                <p className="text-xs text-muted-foreground font-mono">
                  {searchMode === 'author'
                    ? `Fetching papers by ${authorQuery}...`
                    : `Processing ${Math.min(activeTopics.length, 10)} research topics...`}
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </Card>
    </div>
  );
}
