import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { usePaperHistory } from '@/hooks/usePaperHistory';
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
  const { scrapes, isLoading, deleteScrape, refresh } = usePaperHistory();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { toast } = useToast();

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

  const handleDeleteScrape = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteScrape(id);
    if (selectedId === id) setSelectedId(null);
    toast({
      title: 'Deleted',
      description: 'Paper scrape record removed',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
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
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-background/40 backdrop-blur-xl rounded-xl border border-border/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <History className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-mono font-medium tracking-wide">PAPER ARCHIVE</h3>
              <p className="text-xs font-mono text-muted-foreground">
                {scrapes.length} stored searches
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={refresh}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {scrapes.length === 0 ? (
        <div className="text-center py-12 bg-background/20 backdrop-blur-sm rounded-xl border border-dashed border-border/30">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <div className="font-mono text-xs text-muted-foreground/60 tracking-wider">
            NO PAPER SEARCHES
          </div>
          <p className="text-xs text-muted-foreground/40 mt-2">
            Search for papers to see history here
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-2 pr-4">
            {scrapes.map((scrape, index) => {
              const isSelected = selectedId === scrape.id;
              const hasAuthor = !!scrape.author_query;
              const hasKeywords = scrape.keywords.length > 0;

              return (
                <div
                  key={scrape.id}
                  className={`
                    group p-4 rounded-lg border cursor-pointer transition-all duration-200
                    hover:border-blue-500/40 hover:bg-background/40 hover:shadow-[0_0_15px_rgba(59,130,246,0.05)]
                    ${isSelected 
                      ? 'border-blue-500/50 bg-blue-500/5' 
                      : 'border-border/30 bg-background/20'}
                  `}
                  onClick={() => handleLoadScrape(scrape)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Meta badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground/50">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        {hasAuthor && (
                          <Badge variant="secondary" className="text-[10px] font-mono bg-background/50 border border-border/30">
                            <User className="w-2.5 h-2.5 mr-1" />
                            {scrape.author_query}
                          </Badge>
                        )}
                        {scrape.year_min && scrape.year_max && (
                          <Badge variant="outline" className="text-[10px] font-mono bg-background/30 border-border/30">
                            <Calendar className="w-2.5 h-2.5 mr-1" />
                            {scrape.year_min}-{scrape.year_max}
                          </Badge>
                        )}
                        <span className="text-[10px] font-mono text-muted-foreground/50">
                          {formatDistanceToNow(new Date(scrape.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      
                      {/* Stats */}
                      <div className="flex items-center gap-4 mt-2 text-xs font-mono">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <BookOpen className="w-3 h-3" />
                          {scrape.total_papers} papers
                        </span>
                        {hasKeywords && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Tag className="w-3 h-3" />
                            {scrape.keywords.length} keywords
                          </span>
                        )}
                      </div>

                      {/* Keywords preview */}
                      {hasKeywords && (
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          {scrape.keywords.slice(0, 3).map(keyword => (
                            <Badge 
                              key={keyword} 
                              variant="secondary" 
                              className="text-[10px] font-mono px-1.5 py-0 bg-background/40 border border-border/20"
                            >
                              {keyword}
                            </Badge>
                          ))}
                          {scrape.keywords.length > 3 && (
                            <span className="text-[10px] font-mono text-muted-foreground/50">
                              +{scrape.keywords.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDeleteScrape(scrape.id, e)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'rotate-90 text-blue-400' : 'text-muted-foreground/40'}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
