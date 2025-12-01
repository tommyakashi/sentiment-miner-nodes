import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  History, 
  Calendar, 
  BookOpen,
  Trash2,
  RefreshCw,
  ChevronRight,
  Tag,
  User
} from 'lucide-react';
import type { AcademicPaper, PaperScrapeRecord } from '@/types/paper';
import { formatDistanceToNow } from 'date-fns';

interface PaperHistoryProps {
  onLoadScrape: (data: AcademicPaper[]) => void;
}

export function PaperHistory({ onLoadScrape }: PaperHistoryProps) {
  const [scrapes, setScrapes] = useState<PaperScrapeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchScrapes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('paper_scrapes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const parsedScrapes: PaperScrapeRecord[] = (data || []).map(item => ({
        id: item.id,
        keywords: item.keywords || [],
        author_query: item.author_query,
        year_min: item.year_min,
        year_max: item.year_max,
        domains: item.domains,
        total_papers: item.total_papers || 0,
        papers: (Array.isArray(item.papers) ? item.papers as unknown as AcademicPaper[] : []),
        created_at: item.created_at,
      }));

      setScrapes(parsedScrapes);
    } catch (error) {
      console.error('Error fetching paper scrapes:', error);
      toast({
        title: 'Error loading history',
        description: 'Could not fetch paper scrape history',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScrapes();
  }, []);

  const handleLoadScrape = (scrape: PaperScrapeRecord) => {
    setSelectedId(scrape.id);
    
    if (scrape.papers.length === 0) {
      toast({
        title: 'No data',
        description: 'This scrape contains no papers to analyze',
        variant: 'destructive',
      });
      return;
    }

    onLoadScrape(scrape.papers);
    toast({
      title: 'Papers loaded',
      description: `Loaded ${scrape.papers.length} papers for analysis`,
    });
  };

  const handleDeleteScrape = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { error } = await supabase
        .from('paper_scrapes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setScrapes(prev => prev.filter(s => s.id !== id));
      if (selectedId === id) setSelectedId(null);
      
      toast({
        title: 'Deleted',
        description: 'Paper scrape record removed',
      });
    } catch (error) {
      console.error('Error deleting scrape:', error);
      toast({
        title: 'Error',
        description: 'Could not delete scrape',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4 bg-card/80 backdrop-blur-sm border-border/50 data-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-muted rounded-lg">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Paper Archive</h3>
            <p className="text-sm text-muted-foreground font-mono">
              {scrapes.length} stored searches
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchScrapes}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {scrapes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No paper searches yet</p>
          <p className="text-sm">Search for papers to see history here</p>
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-3 pr-4">
            {scrapes.map((scrape) => {
              const isSelected = selectedId === scrape.id;
              const hasAuthor = !!scrape.author_query;
              const hasKeywords = scrape.keywords.length > 0;

              return (
                <div
                  key={scrape.id}
                  className={`
                    p-4 rounded-lg border cursor-pointer transition-all
                    hover:border-emerald-500/50 hover:bg-muted/30
                    ${isSelected ? 'border-emerald-500 bg-emerald-500/5' : 'border-border'}
                  `}
                  onClick={() => handleLoadScrape(scrape)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {hasAuthor && (
                          <Badge variant="secondary" className="text-xs">
                            <User className="w-3 h-3 mr-1" />
                            {scrape.author_query}
                          </Badge>
                        )}
                        {scrape.year_min && scrape.year_max && (
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="w-3 h-3 mr-1" />
                            {scrape.year_min}-{scrape.year_max}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(scrape.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                          {scrape.total_papers} papers
                        </span>
                        {hasKeywords && (
                          <span className="flex items-center gap-1">
                            <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                            {scrape.keywords.length} keywords
                          </span>
                        )}
                      </div>

                      {hasKeywords && (
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          {scrape.keywords.slice(0, 3).map(keyword => (
                            <Badge key={keyword} variant="secondary" className="text-xs px-1.5 py-0">
                              {keyword}
                            </Badge>
                          ))}
                          {scrape.keywords.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{scrape.keywords.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDeleteScrape(scrape.id, e)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'rotate-90 text-emerald-500' : 'text-muted-foreground'}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}
