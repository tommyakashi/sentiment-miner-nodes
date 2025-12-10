import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Home, Radio, BookOpen, Calendar, BarChart2, Trash2 } from 'lucide-react';
import { useScrapeHistory, ScrapeRecord } from '@/hooks/useScrapeHistory';
import { usePaperHistory } from '@/hooks/usePaperHistory';
import { format } from 'date-fns';

interface ArchivePageProps {
  sourceType: 'reddit' | 'papers';
  onGoHome: () => void;
  onLoadScrape: (data: any) => void;
}

export function ArchivePage({ sourceType, onGoHome, onLoadScrape }: ArchivePageProps) {
  const { scrapes: redditScrapes, deleteScrape: deleteRedditScrape, getScrapeData } = useScrapeHistory();
  const { scrapes: paperScrapes, deleteScrape: deletePaperScrape } = usePaperHistory();

  const isReddit = sourceType === 'reddit';
  const scrapes = isReddit ? redditScrapes : paperScrapes;

  const handleLoad = (scrape: any) => {
    if (isReddit) {
      const data = getScrapeData(scrape.id);
      if (data) {
        onLoadScrape(data);
      }
    } else {
      // For papers, the papers array is stored directly in the scrape
      if (scrape.papers && Array.isArray(scrape.papers)) {
        onLoadScrape(scrape.papers);
      }
    }
  };

  const handleDelete = (id: string) => {
    if (isReddit) {
      deleteRedditScrape(id);
    } else {
      deletePaperScrape(id);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={onGoHome} className="gap-2">
              <Home className="w-4 h-4" />
              Home
            </Button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              {isReddit ? (
                <Radio className="w-4 h-4 text-orange-400" />
              ) : (
                <BookOpen className="w-4 h-4 text-blue-400" />
              )}
              <span className="text-sm font-mono text-muted-foreground">
                {isReddit ? 'Reddit' : 'Paper'} Archive
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Archive Content */}
      <ScrollArea className="h-[calc(100vh-65px)]">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-mono font-bold text-foreground mb-2">
              Past {isReddit ? 'Reddit' : 'Paper'} Scrapes
            </h1>
            <p className="text-muted-foreground font-mono text-sm">
              {scrapes.length} saved scrape{scrapes.length !== 1 ? 's' : ''} in your archive
            </p>
          </div>

          {scrapes.length > 0 ? (
            <div className="space-y-3">
              {scrapes.map((scrape: any) => (
                <Card
                  key={scrape.id}
                  className="p-4 bg-card/60 backdrop-blur-sm border-border/50 hover:border-border transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isReddit ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-blue-500/10 border border-blue-500/20'
                        }`}>
                          {isReddit ? (
                            <Radio className="w-4 h-4 text-orange-400" />
                          ) : (
                            <BookOpen className="w-4 h-4 text-blue-400" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">
                            {scrape.name || `${isReddit ? 'Reddit' : 'Paper'} Scrape`}
                          </h3>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(scrape.created_at), 'MMM d, yyyy HH:mm')}
                            </span>
                            <span className="flex items-center gap-1">
                              <BarChart2 className="w-3 h-3" />
                              {scrape.item_count || scrape.total_papers || 0} items
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLoad(scrape)}
                        className="font-mono text-xs"
                      >
                        Load & Analyze
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(scrape.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto bg-muted/20 rounded-full flex items-center justify-center mb-4">
                {isReddit ? (
                  <Radio className="w-8 h-8 text-muted-foreground/30" />
                ) : (
                  <BookOpen className="w-8 h-8 text-muted-foreground/30" />
                )}
              </div>
              <h3 className="text-lg font-semibold mb-2">No Saved Scrapes</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Complete a scrape to save it to your archive.
              </p>
              <Button variant="outline" onClick={onGoHome}>
                Start Scraping
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
