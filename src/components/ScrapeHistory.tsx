import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useSavedPosts } from '@/hooks/useSavedPosts';
import { supabase } from '@/integrations/supabase/client';
import { 
  History, 
  Calendar, 
  MessageSquare, 
  TrendingUp,
  Trash2,
  RefreshCw,
  ChevronRight,
  Bookmark,
  ArrowBigUp,
  ExternalLink
} from 'lucide-react';
import type { RedditData } from '@/types/reddit';
import { formatDistanceToNow } from 'date-fns';

interface ScrapeRecord {
  id: string;
  name: string;
  created_at: string;
  item_count: number;
  content: {
    posts?: any[];
    comments?: any[];
    subredditStats?: Record<string, { posts: number; comments: number }>;
    timeRange?: string;
    scrapedAt?: string;
    totalSubreddits?: number;
  };
}

interface ScrapeHistoryProps {
  onLoadScrape: (data: RedditData[]) => void;
}

export function ScrapeHistory({ onLoadScrape }: ScrapeHistoryProps) {
  const [scrapes, setScrapes] = useState<ScrapeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { toast } = useToast();
  const { savedPosts, unsavePost } = useSavedPosts();

  const fetchScrapes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_sources')
        .select('*')
        .in('source_type', ['reddit_bulk', 'reddit_scheduled'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Type-safe parsing of JSON content
      const parsedScrapes: ScrapeRecord[] = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        created_at: item.created_at,
        item_count: item.item_count || 0,
        content: typeof item.content === 'object' && item.content !== null 
          ? item.content as ScrapeRecord['content']
          : {}
      }));

      setScrapes(parsedScrapes);
    } catch (error) {
      console.error('Error fetching scrapes:', error);
      toast({
        title: 'Error loading history',
        description: 'Could not fetch scrape history',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScrapes();
  }, []);

  const handleLoadScrape = (scrape: ScrapeRecord) => {
    setSelectedId(scrape.id);
    
    const posts = scrape.content?.posts || [];
    const comments = scrape.content?.comments || [];
    const allData = [...posts, ...comments] as RedditData[];

    if (allData.length === 0) {
      toast({
        title: 'No data',
        description: 'This scrape contains no data to analyze',
        variant: 'destructive',
      });
      return;
    }

    onLoadScrape(allData);
    toast({
      title: 'Data loaded',
      description: `Loaded ${posts.length} posts and ${comments.length} comments`,
    });
  };

  const handleDeleteScrape = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { error } = await supabase
        .from('data_sources')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setScrapes(prev => prev.filter(s => s.id !== id));
      if (selectedId === id) setSelectedId(null);
      
      toast({
        title: 'Deleted',
        description: 'Scrape record removed',
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

  const getTimeRangeLabel = (timeRange?: string) => {
    const labels: Record<string, string> = {
      'day': 'Today',
      '3days': '3 Days',
      'week': '1 Week',
      'month': '1 Month',
    };
    return labels[timeRange || ''] || timeRange || 'Unknown';
  };

  const getTopSubreddits = (stats?: Record<string, { posts: number; comments: number }>) => {
    if (!stats) return [];
    return Object.entries(stats)
      .sort((a, b) => (b[1].posts + b[1].comments) - (a[1].posts + a[1].comments))
      .slice(0, 3)
      .map(([sub]) => sub);
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
      {/* Saved for Later Section */}
      {savedPosts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-foreground" />
            <h4 className="font-semibold text-sm">Saved for Later</h4>
            <Badge variant="secondary" className="text-xs">{savedPosts.length}</Badge>
          </div>
          <div className="space-y-2">
            {savedPosts.slice(0, 5).map((post) => (
              <div
                key={post.id}
                className="p-3 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="text-sm font-medium truncate">
                        {post.title.length > 50 ? `${post.title.slice(0, 50)}...` : post.title}
                      </h5>
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        {post.parsedCommunityName}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ArrowBigUp className="w-3 h-3 text-orange-500" />
                        {post.upVotes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {post.numberOfComments}
                      </span>
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View
                      </a>
                      <a
                        href={`https://www.reddit.com/user/${post.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        <Avatar className="w-3 h-3">
                          <AvatarFallback className="text-[6px] bg-muted">
                            {post.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {post.username}
                      </a>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      unsavePost(post.id);
                      toast({ title: 'Removed', description: 'Post removed from saved' });
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
            {savedPosts.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                +{savedPosts.length - 5} more saved posts
              </p>
            )}
          </div>
        </div>
      )}

      {savedPosts.length > 0 && scrapes.length > 0 && (
        <div className="border-t border-border" />
      )}

      {/* Signal Archive Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-muted rounded-lg">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Signal Archive</h3>
            <p className="text-sm text-muted-foreground font-mono">
              {scrapes.length} stored datasets
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchScrapes}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {scrapes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No scrape history yet</p>
          <p className="text-sm">Run your first scrape above</p>
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-3 pr-4">
            {scrapes.map((scrape) => {
              const posts = scrape.content?.posts?.length || 0;
              const comments = scrape.content?.comments?.length || 0;
              const topSubs = getTopSubreddits(scrape.content?.subredditStats);
              const isSelected = selectedId === scrape.id;
              const isScheduled = scrape.name.includes('Scheduled');

              return (
                <div
                  key={scrape.id}
                  className={`
                    p-4 rounded-lg border cursor-pointer transition-all
                    hover:border-primary/50 hover:bg-muted/30
                    ${isSelected ? 'border-primary bg-primary/5' : 'border-border'}
                  `}
                  onClick={() => handleLoadScrape(scrape)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={isScheduled ? 'secondary' : 'outline'} className="text-xs">
                          {isScheduled ? '⏰ Scheduled' : getTimeRangeLabel(scrape.content?.timeRange)}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDistanceToNow(new Date(scrape.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                          {posts} posts
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                          {comments} comments
                        </span>
                      </div>

                      {topSubs.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          {topSubs.map(sub => (
                            <Badge key={sub} variant="secondary" className="text-xs px-1.5 py-0">
                              r/{sub}
                            </Badge>
                          ))}
                          {(scrape.content?.totalSubreddits || 0) > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{(scrape.content?.totalSubreddits || 0) - 3} more
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
                      <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'rotate-90 text-primary' : 'text-muted-foreground'}`} />
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
