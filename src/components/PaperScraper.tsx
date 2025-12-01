import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { 
  BookOpen, 
  Loader2, 
  Search,
  User,
  CalendarIcon,
  CheckCircle2,
  Target,
  Sparkles,
  Zap,
  Database,
  Plus,
  X
} from 'lucide-react';
import type { AcademicPaper } from '@/types/paper';
import type { Node } from '@/types/sentiment';

interface PaperScraperProps {
  onDataScraped: (data: AcademicPaper[]) => void;
  nodes: Node[];
}

type SearchMode = 'nodes' | 'author' | 'combined';

export function PaperScraper({ onDataScraped, nodes }: PaperScraperProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>('nodes');
  const [authorQuery, setAuthorQuery] = useState('');
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 2);
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [progress, setProgress] = useState(0);
  const [lastScrape, setLastScrape] = useState<{ totalPapers: number; topics: string[] } | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [newKeyword, setNewKeyword] = useState('');
  const startTimeRef = useRef<number>(0);
  const { toast } = useToast();

  // Initialize selected nodes to all nodes
  useEffect(() => {
    if (nodes.length > 0 && selectedNodes.length === 0) {
      setSelectedNodes(nodes.map(n => n.id));
    }
  }, [nodes]);

  // Get search topics based on selected nodes
  const getSearchTopics = () => {
    const topics: string[] = [];
    
    nodes
      .filter(n => selectedNodes.includes(n.id))
      .forEach(node => {
        topics.push(node.name);
        if (node.keywords.length > 0) {
          topics.push(...node.keywords.slice(0, 3));
        }
      });
    
    topics.push(...customKeywords);
    return [...new Set(topics)];
  };

  const activeTopics = getSearchTopics();

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

  const handleScrape = async () => {
    if (searchMode !== 'author' && activeTopics.length === 0) {
      toast({
        title: 'No topics selected',
        description: 'Select at least one node topic or add custom keywords.',
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const searchTopics = searchMode === 'author' ? [] : activeTopics.slice(0, 10);
      const searchAuthor = searchMode === 'nodes' ? undefined : authorQuery.trim();

      const { data, error } = await supabase.functions.invoke('scrape-papers', {
        body: {
          keywords: searchTopics,
          authorQuery: searchAuthor,
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
          limit: 100,
          saveToDb: true,
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Scrape failed');

      setProgress(100);
      setLastScrape({
        totalPapers: data.summary.totalPapers,
        topics: searchTopics,
      });

      if (data.data && data.data.length > 0) {
        onDataScraped(data.data);
        toast({
          title: 'Scrape Complete',
          description: `Found ${data.summary.totalPapers} papers from Semantic Scholar.`,
        });
      } else {
        toast({
          title: 'No Papers Found',
          description: 'Try different topics or expand the date range.',
          variant: 'destructive',
        });
      }

    } catch (error) {
      console.error('Paper scrape error:', error);
      toast({
        title: 'Scrape Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => setProgress(0), 3000);
    }
  };

  const toggleNode = (nodeId: string) => {
    setSelectedNodes(prev => 
      prev.includes(nodeId) 
        ? prev.filter(id => id !== nodeId)
        : [...prev, nodeId]
    );
  };

  const addCustomKeyword = () => {
    if (newKeyword.trim() && !customKeywords.includes(newKeyword.trim())) {
      setCustomKeywords(prev => [...prev, newKeyword.trim()]);
      setNewKeyword('');
    }
  };

  const removeCustomKeyword = (keyword: string) => {
    setCustomKeywords(prev => prev.filter(k => k !== keyword));
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card className="p-6 bg-card/60 backdrop-blur-sm border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-tight">Academic Scanner</h3>
              <div className="flex items-center gap-2 mt-1">
                <Database className="w-3 h-3 text-blue-400" />
                <span className="text-xs font-mono text-muted-foreground">SEMANTIC SCHOLAR + arXiv</span>
              </div>
            </div>
          </div>
          
          {/* Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <span className={cn(
              "w-2 h-2 rounded-full",
              isLoading ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
            )} />
            <span className="text-xs font-mono text-blue-400">
              {isLoading ? 'SCANNING' : 'READY'}
            </span>
          </div>
        </div>
      </Card>

      {/* Search Configuration */}
      <Card className="p-5 space-y-5 bg-card/60 backdrop-blur-sm border-border/50">
        {/* Search Mode */}
        <div className="space-y-3">
          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Search Mode</label>
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
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                  "border",
                  searchMode === id
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                    : "bg-background/30 border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
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
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Author Name</label>
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
          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Publication Window</label>
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "flex-1 justify-start text-left font-mono bg-background/30 border-border/50",
                    !startDate && "text-muted-foreground"
                  )}
                  disabled={isLoading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-blue-400" />
                  {startDate ? format(startDate, "MMM yyyy") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  disabled={(date) => date > endDate || date > new Date()}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            
            <div className="w-8 h-px bg-border/50" />
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "flex-1 justify-start text-left font-mono bg-background/30 border-border/50",
                    !endDate && "text-muted-foreground"
                  )}
                  disabled={isLoading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-blue-400" />
                  {endDate ? format(endDate, "MMM yyyy") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => date && setEndDate(date)}
                  disabled={(date) => date < startDate || date > new Date()}
                  initialFocus
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
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Research Topics
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-blue-400">
                  {selectedNodes.length}/{nodes.length}
                </span>
                <button
                  onClick={() => setSelectedNodes(nodes.map(n => n.id))}
                  disabled={isLoading}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedNodes([])}
                  disabled={isLoading}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  None
                </button>
              </div>
            </div>
            
            {/* Wrapped Chips */}
            <div className="flex flex-wrap gap-2">
              {nodes.map((node) => {
                const isSelected = selectedNodes.includes(node.id);
                return (
                  <button
                    key={node.id}
                    onClick={() => !isLoading && toggleNode(node.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      "border",
                      isSelected
                        ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                        : "bg-background/30 border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                    )}
                  >
                    {node.name}
                  </button>
                );
              })}
            </div>

            {/* Custom Keywords */}
            <div className="space-y-2 pt-3 border-t border-border/30">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Additional Terms
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add custom search term"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomKeyword()}
                  disabled={isLoading}
                  className="bg-background/30 border-border/50"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={addCustomKeyword}
                  disabled={isLoading || !newKeyword.trim()}
                  className="shrink-0 border-border/50"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {customKeywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {customKeywords.map((keyword) => (
                    <Badge
                      key={keyword}
                      variant="outline"
                      className="bg-primary/10 text-foreground border-primary/20 pr-1"
                    >
                      {keyword}
                      <button
                        onClick={() => !isLoading && removeCustomKeyword(keyword)}
                        className="ml-1 p-0.5 rounded hover:bg-primary/20"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Progress */}
        {isLoading && (
          <div className="space-y-3 p-4 rounded-lg bg-background/30 border border-border/50">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                <span className="font-mono text-blue-400">SCANNING</span>
              </div>
              <span className="font-mono text-foreground">{elapsedTime}s</span>
            </div>
            <Progress value={progress} className="h-1.5" />
            <p className="text-xs text-muted-foreground font-mono">
              {searchMode === 'author' 
                ? `Fetching papers by ${authorQuery}...`
                : `Processing ${Math.min(activeTopics.length, 10)} research topics...`}
            </p>
          </div>
        )}

        {/* Scan Button */}
        <Button
          className="w-full h-12 text-lg"
          onClick={handleScrape}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Scanning Academic Database...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 mr-2" />
              Scan Papers • {format(startDate, "MMM yy")} – {format(endDate, "MMM yy")}
            </>
          )}
        </Button>
      </Card>

      {/* Results Summary */}
      {lastScrape && !isLoading && (
        <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Last Scan Complete</p>
              <p className="text-sm text-muted-foreground">
                Found <span className="font-mono text-emerald-400">{lastScrape.totalPapers}</span> papers
                {lastScrape.topics.length > 0 && ` across ${lastScrape.topics.length} topics`}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
