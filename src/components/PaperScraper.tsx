import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { 
  BookOpen, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  Search,
  User,
  CalendarIcon,
  CheckCircle2,
  Tag,
  Target
} from 'lucide-react';
import type { AcademicPaper } from '@/types/paper';
import type { Node } from '@/types/sentiment';

interface PaperScraperProps {
  onDataScraped: (data: AcademicPaper[]) => void;
  nodes: Node[];
}

type SearchMode = 'nodes' | 'author' | 'combined';

const DOMAIN_OPTIONS = [
  'Computer Science',
  'Psychology',
  'Medicine',
  'Biology',
  'Economics',
  'Physics',
  'Mathematics',
  'Engineering',
];

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
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [showTopics, setShowTopics] = useState(true);
  const [lastScrape, setLastScrape] = useState<{ totalPapers: number; topics: string[] } | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
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
        // Add full node name as a topic (more academically relevant)
        topics.push(node.name);
        
        // Add any configured keywords
        if (node.keywords.length > 0) {
          topics.push(...node.keywords.slice(0, 3));
        }
      });
    
    // Add custom keywords
    topics.push(...customKeywords);
    
    return [...new Set(topics)]; // Deduplicate
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

      const searchTopics = searchMode === 'author' ? [] : activeTopics.slice(0, 10); // Limit to 10 topics
      const searchAuthor = searchMode === 'nodes' ? undefined : authorQuery.trim();

      const { data, error } = await supabase.functions.invoke('scrape-papers', {
        body: {
          keywords: searchTopics,
          authorQuery: searchAuthor,
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
          domains: selectedDomains.length > 0 ? selectedDomains : undefined,
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

  const toggleDomain = (domain: string) => {
    setSelectedDomains(prev =>
      prev.includes(domain)
        ? prev.filter(d => d !== domain)
        : [...prev, domain]
    );
  };

  const addCustomKeyword = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = (e.target as HTMLInputElement).value.trim();
      if (value && !customKeywords.includes(value)) {
        setCustomKeywords(prev => [...prev, value]);
        (e.target as HTMLInputElement).value = '';
      }
    }
  };

  const removeCustomKeyword = (keyword: string) => {
    setCustomKeywords(prev => prev.filter(k => k !== keyword));
  };

  return (
    <Card className="p-6 space-y-6 bg-card/80 backdrop-blur-sm border-border/50 data-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg" style={{ boxShadow: '0 0 20px hsl(160 84% 39% / 0.3)' }}>
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Academic Paper Scanner</h3>
            <p className="text-sm text-muted-foreground font-mono">
              Semantic Scholar API • Node-based search
            </p>
          </div>
        </div>
      </div>

      {/* Search Mode Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Search Mode</label>
        <div className="flex gap-2">
          <Button
            variant={searchMode === 'nodes' ? 'default' : 'outline'}
            size="sm"
            className="flex items-center gap-1.5"
            onClick={() => setSearchMode('nodes')}
            disabled={isLoading}
          >
            <Target className="w-3.5 h-3.5" />
            By Nodes
          </Button>
          <Button
            variant={searchMode === 'author' ? 'default' : 'outline'}
            size="sm"
            className="flex items-center gap-1.5"
            onClick={() => setSearchMode('author')}
            disabled={isLoading}
          >
            <User className="w-3.5 h-3.5" />
            By Author
          </Button>
          <Button
            variant={searchMode === 'combined' ? 'default' : 'outline'}
            size="sm"
            className="flex items-center gap-1.5"
            onClick={() => setSearchMode('combined')}
            disabled={isLoading}
          >
            <Search className="w-3.5 h-3.5" />
            Combined
          </Button>
        </div>
      </div>

      {/* Author Search Input */}
      {(searchMode === 'author' || searchMode === 'combined') && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Author Name</label>
          <Input
            placeholder="e.g., Yoshua Bengio"
            value={authorQuery}
            onChange={(e) => setAuthorQuery(e.target.value)}
            disabled={isLoading}
          />
        </div>
      )}

      {/* Date Range with Month Picker */}
      <div className="space-y-3">
        <label className="text-sm font-medium flex items-center gap-2">
          <CalendarIcon className="w-4 h-4" />
          Publication Date Range
        </label>
        <div className="flex items-center gap-3 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[180px] justify-start text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
                disabled={isLoading}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "MMM yyyy") : "Start date"}
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
          
          <span className="text-muted-foreground">to</span>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[180px] justify-start text-left font-normal",
                  !endDate && "text-muted-foreground"
                )}
                disabled={isLoading}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "MMM yyyy") : "End date"}
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
        <p className="text-xs text-muted-foreground">
          Searching papers published between {format(startDate, "MMMM yyyy")} and {format(endDate, "MMMM yyyy")}
        </p>
      </div>

      {/* Node Topics Selection */}
      {(searchMode === 'nodes' || searchMode === 'combined') && (
        <Collapsible open={showTopics} onOpenChange={setShowTopics}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Research Topics ({selectedNodes.length}/{nodes.length} nodes selected)
              </span>
              {showTopics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-4">
            {/* Node Selection */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Select nodes to search</label>
              <div className="flex flex-wrap gap-2">
                {nodes.map((node) => {
                  const isSelected = selectedNodes.includes(node.id);
                  return (
                    <Badge
                      key={node.id}
                      variant={isSelected ? 'default' : 'outline'}
                      className={cn(
                        "cursor-pointer transition-all hover:scale-105",
                        isSelected && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"
                      )}
                      onClick={() => !isLoading && toggleNode(node.id)}
                    >
                      {node.name}
                    </Badge>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedNodes(nodes.map(n => n.id))}
                  disabled={isLoading}
                >
                  Select All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedNodes([])}
                  disabled={isLoading}
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* Custom Keywords */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Additional search terms</label>
              <Input
                placeholder="Add custom keyword and press Enter"
                onKeyDown={addCustomKeyword}
                disabled={isLoading}
              />
              {customKeywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {customKeywords.map((keyword) => (
                    <Badge
                      key={keyword}
                      variant="secondary"
                      className="cursor-pointer bg-primary/20 text-primary border-primary/30"
                      onClick={() => !isLoading && removeCustomKeyword(keyword)}
                    >
                      {keyword} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Active Search Terms Preview */}
            {activeTopics.length > 0 && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Will search for ({Math.min(activeTopics.length, 10)} topics):
                </p>
                <p className="text-xs text-foreground/80 line-clamp-3">
                  {activeTopics.slice(0, 10).map((t, i) => (
                    <span key={t}>
                      "{t}"{i < Math.min(activeTopics.length, 10) - 1 ? ', ' : ''}
                    </span>
                  ))}
                  {activeTopics.length > 10 && <span className="text-muted-foreground"> +{activeTopics.length - 10} more</span>}
                </p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Domain Filters */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Domains (optional)</label>
        <div className="flex flex-wrap gap-2">
          {DOMAIN_OPTIONS.map((domain) => (
            <Badge
              key={domain}
              variant={selectedDomains.includes(domain) ? 'default' : 'outline'}
              className="cursor-pointer transition-all hover:scale-105"
              onClick={() => !isLoading && toggleDomain(domain)}
            >
              {domain}
            </Badge>
          ))}
        </div>
      </div>

      {/* Progress */}
      {isLoading && (
        <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Searching Semantic Scholar...</span>
            <span className="font-mono text-muted-foreground">{elapsedTime}s</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />
            {searchMode === 'author' 
              ? `Fetching papers by ${authorQuery}...`
              : `Processing ${Math.min(activeTopics.length, 10)} topics...`}
          </div>
        </div>
      )}

      {/* Scrape Button */}
      <Button
        className="w-full h-12 text-lg"
        onClick={handleScrape}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Searching...
          </>
        ) : (
          <>
            <Search className="w-5 h-5 mr-2" />
            Search Papers ({format(startDate, "MMM yy")} - {format(endDate, "MMM yy")})
          </>
        )}
      </Button>

      {/* Last Scrape Summary */}
      {lastScrape && !isLoading && (
        <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="font-medium">Last Search</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Papers found:</span>
              <span className="ml-2 font-mono text-emerald-400">{lastScrape.totalPapers}</span>
            </div>
            {lastScrape.topics.length > 0 && (
              <div>
                <span className="text-muted-foreground">Topics:</span>
                <span className="ml-2 font-mono">{lastScrape.topics.length}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
