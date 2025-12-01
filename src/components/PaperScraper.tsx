import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  BookOpen, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  Search,
  User,
  Calendar,
  CheckCircle2,
  Tag,
  Quote
} from 'lucide-react';
import type { AcademicPaper } from '@/types/paper';
import type { Node } from '@/types/sentiment';

interface PaperScraperProps {
  onDataScraped: (data: AcademicPaper[]) => void;
  nodes: Node[];
}

type SearchMode = 'keywords' | 'author' | 'combined';

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
  const [searchMode, setSearchMode] = useState<SearchMode>('keywords');
  const [authorQuery, setAuthorQuery] = useState('');
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [yearMin, setYearMin] = useState(2020);
  const [yearMax, setYearMax] = useState(new Date().getFullYear());
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [showKeywords, setShowKeywords] = useState(false);
  const [lastScrape, setLastScrape] = useState<{ totalPapers: number; keywords: string[] } | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const startTimeRef = useRef<number>(0);
  const { toast } = useToast();

  // Generate keywords from nodes
  const nodeKeywords = nodes.flatMap(node => {
    const words = node.name.split(/[\s&]+/).filter(w => w.length > 2);
    return [...words, ...node.keywords];
  }).filter((v, i, a) => a.indexOf(v) === i).slice(0, 10);

  const activeKeywords = customKeywords.length > 0 ? customKeywords : nodeKeywords;

  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setElapsedTime(Math.floor(elapsed / 1000));
      
      // Simulate progress based on time (API calls take ~2-3s each)
      const estimatedKeywords = searchMode === 'author' ? 1 : activeKeywords.length;
      const timePerKeyword = 2000;
      const expectedTime = estimatedKeywords * timePerKeyword;
      const progressPercent = Math.min((elapsed / expectedTime) * 90, 90);
      setProgress(progressPercent);
    }, 200);

    return () => clearInterval(interval);
  }, [isLoading, activeKeywords.length, searchMode]);

  const handleScrape = async () => {
    if (searchMode !== 'author' && activeKeywords.length === 0) {
      toast({
        title: 'No keywords',
        description: 'Add keywords or configure nodes in Settings.',
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

      const searchKeywords = searchMode === 'author' ? [] : activeKeywords;
      const searchAuthor = searchMode === 'keywords' ? undefined : authorQuery.trim();

      const { data, error } = await supabase.functions.invoke('scrape-papers', {
        body: {
          keywords: searchKeywords,
          authorQuery: searchAuthor,
          yearMin,
          yearMax,
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
        keywords: searchKeywords,
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
          description: 'Try different keywords or expand the year range.',
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

  const toggleKeyword = (keyword: string) => {
    setCustomKeywords(prev => 
      prev.includes(keyword) 
        ? prev.filter(k => k !== keyword)
        : [...prev, keyword]
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
              Semantic Scholar API
            </p>
          </div>
        </div>
      </div>

      {/* Search Mode Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Search Mode</label>
        <div className="flex gap-2">
          <Button
            variant={searchMode === 'keywords' ? 'default' : 'outline'}
            size="sm"
            className="flex items-center gap-1.5"
            onClick={() => setSearchMode('keywords')}
            disabled={isLoading}
          >
            <Tag className="w-3.5 h-3.5" />
            Keywords
          </Button>
          <Button
            variant={searchMode === 'author' ? 'default' : 'outline'}
            size="sm"
            className="flex items-center gap-1.5"
            onClick={() => setSearchMode('author')}
            disabled={isLoading}
          >
            <User className="w-3.5 h-3.5" />
            Author
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

      {/* Year Range */}
      <div className="space-y-3">
        <label className="text-sm font-medium flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Year Range
        </label>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={1990}
            max={new Date().getFullYear()}
            value={yearMin}
            onChange={(e) => setYearMin(parseInt(e.target.value) || 2020)}
            className="w-24"
            disabled={isLoading}
          />
          <span className="text-muted-foreground">to</span>
          <Input
            type="number"
            min={1990}
            max={new Date().getFullYear()}
            value={yearMax}
            onChange={(e) => setYearMax(parseInt(e.target.value) || new Date().getFullYear())}
            className="w-24"
            disabled={isLoading}
          />
        </div>
      </div>

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

      {/* Keywords (for keyword and combined modes) */}
      {(searchMode === 'keywords' || searchMode === 'combined') && (
        <Collapsible open={showKeywords} onOpenChange={setShowKeywords}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Search Keywords ({activeKeywords.length} active)
              </span>
              {showKeywords ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-3">
            <Input
              placeholder="Add custom keyword and press Enter"
              onKeyDown={addCustomKeyword}
              disabled={isLoading}
            />
            <ScrollArea className="h-[150px] border rounded-lg p-3">
              <div className="flex flex-wrap gap-2">
                {nodeKeywords.map((keyword) => {
                  const isActive = customKeywords.length === 0 || customKeywords.includes(keyword);
                  return (
                    <Badge
                      key={keyword}
                      variant={isActive ? 'default' : 'outline'}
                      className="cursor-pointer transition-all hover:scale-105"
                      onClick={() => toggleKeyword(keyword)}
                    >
                      {keyword}
                    </Badge>
                  );
                })}
                {customKeywords.filter(k => !nodeKeywords.includes(k)).map((keyword) => (
                  <Badge
                    key={keyword}
                    variant="default"
                    className="cursor-pointer transition-all hover:scale-105 bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    onClick={() => toggleKeyword(keyword)}
                  >
                    {keyword} ×
                  </Badge>
                ))}
              </div>
            </ScrollArea>
            {customKeywords.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCustomKeywords([])}
              >
                Reset to Node Keywords
              </Button>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

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
              : `Processing ${activeKeywords.length} keywords...`}
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
            Search Papers ({yearMin}-{yearMax})
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
            {lastScrape.keywords.length > 0 && (
              <div>
                <span className="text-muted-foreground">Keywords:</span>
                <span className="ml-2 font-mono">{lastScrape.keywords.length}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
