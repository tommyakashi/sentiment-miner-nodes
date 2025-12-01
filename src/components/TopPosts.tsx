import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  Bookmark, 
  ArrowBigUp, 
  MessageSquare, 
  Clock, 
  ExternalLink,
  ChevronDown,
  TrendingUp,
  Sparkles,
  Users,
  BarChart3
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSavedPosts } from '@/hooks/useSavedPosts';
import type { RedditPost } from '@/types/reddit';

// Generate a brief summary from post title and body
const generateSummary = (post: RedditPost): string => {
  const title = post.title.toLowerCase();
  const body = post.body?.toLowerCase() || '';
  
  const themes: string[] = [];
  
  if (title.includes('warning') || title.includes('beware') || body.includes('warning')) {
    themes.push('raises concerns');
  }
  if (title.includes('question') || title.includes('?') || title.includes('how')) {
    themes.push('seeking advice');
  }
  if (title.includes('leaving') || title.includes('quit') || body.includes('leaving')) {
    themes.push('discusses career transition');
  }
  if (title.includes('ai') || body.includes('artificial intelligence') || body.includes(' ai ')) {
    themes.push('discusses AI');
  }
  if (title.includes('research') || body.includes('research')) {
    themes.push('research-related');
  }
  if (title.includes('funding') || body.includes('funding') || body.includes('grant')) {
    themes.push('funding discussion');
  }
  
  if (themes.length > 0) {
    return `Post ${themes.slice(0, 2).join(' and ')}. ${post.numberOfComments} community responses.`;
  }
  
  if (post.body && post.body.length > 20) {
    return post.body.slice(0, 100).trim() + '...';
  }
  
  return `Discussion with ${post.numberOfComments} community responses.`;
};

// Generate collection summary
const generateCollectionSummary = (posts: RedditPost[]) => {
  if (posts.length === 0) return null;

  const totalUpvotes = posts.reduce((sum, p) => sum + p.upVotes, 0);
  const totalComments = posts.reduce((sum, p) => sum + p.numberOfComments, 0);
  const avgUpvotes = Math.round(totalUpvotes / posts.length);
  const avgComments = Math.round(totalComments / posts.length);
  
  // Count subreddits
  const subredditCounts: Record<string, number> = {};
  posts.forEach(p => {
    subredditCounts[p.parsedCommunityName] = (subredditCounts[p.parsedCommunityName] || 0) + 1;
  });
  const topSubreddits = Object.entries(subredditCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([sub]) => sub);

  // High engagement posts
  const highEngagement = posts.filter(p => p.upVotes > avgUpvotes * 1.5).length;

  return {
    totalUpvotes,
    totalComments,
    avgUpvotes,
    avgComments,
    topSubreddits,
    highEngagement,
    uniqueSubreddits: Object.keys(subredditCounts).length
  };
};

interface TopPostsProps {
  posts: RedditPost[];
  title?: string;
}

export function TopPosts({ posts, title = "Top Posts" }: TopPostsProps) {
  const { toast } = useToast();
  const { isPostSaved, toggleSavePost } = useSavedPosts();
  const [summaryOpen, setSummaryOpen] = useState(true);

  const getEngagementScore = (post: RedditPost): number => {
    const ageInHours = Math.max(1, (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60));
    const engagement = post.upVotes > 0 
      ? (post.upVotes + post.numberOfComments * 3) 
      : (post.numberOfComments * 5);
    return engagement / ageInHours;
  };

  const getEngagementColor = (score: number) => {
    if (score >= 100) return 'text-emerald-400';
    if (score >= 50) return 'text-blue-400';
    if (score >= 20) return 'text-amber-400';
    return 'text-muted-foreground';
  };

  const topPosts = [...posts]
    .map(post => ({ ...post, score: getEngagementScore(post) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const summary = generateCollectionSummary(posts);

  const handleBookmark = (post: RedditPost) => {
    const wasSaved = isPostSaved(post.id);
    toggleSavePost(post);
    
    toast({
      title: wasSaved ? 'Removed from saved' : 'Saved for later',
      description: wasSaved 
        ? 'Post removed from your archive' 
        : 'Post added to Archive → Saved for Later',
    });
  };

  if (topPosts.length === 0) return null;

  return (
    <Card className="p-6 bg-card/60 backdrop-blur-sm border-border/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <Badge variant="secondary" className="font-mono">
          {posts.length} posts
        </Badge>
      </div>

      {/* Collection Summary - Collapsible */}
      {summary && (
        <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen} className="mb-4">
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-between p-3 rounded-lg border border-border/50 bg-background/30">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span className="font-medium">Collection Summary</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${summaryOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="p-4 rounded-lg border border-border/50 bg-background/50 space-y-4">
              {/* Key Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20 text-center">
                  <div className="text-2xl font-bold text-orange-400">{summary.totalUpvotes.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total Upvotes</div>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-center">
                  <div className="text-2xl font-bold text-blue-400">{summary.totalComments.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total Comments</div>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
                  <div className="text-2xl font-bold text-emerald-400">{summary.highEngagement}</div>
                  <div className="text-xs text-muted-foreground">High Engagement</div>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 text-center">
                  <div className="text-2xl font-bold text-purple-400">{summary.uniqueSubreddits}</div>
                  <div className="text-xs text-muted-foreground">Communities</div>
                </div>
              </div>

              {/* Insights */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <BarChart3 className="w-4 h-4 text-primary mt-0.5" />
                  <div className="text-sm">
                    <span className="text-foreground">Average engagement: </span>
                    <span className="font-medium text-orange-400">{summary.avgUpvotes} upvotes</span>
                    <span className="text-foreground"> and </span>
                    <span className="font-medium text-blue-400">{summary.avgComments} comments</span>
                    <span className="text-foreground"> per post.</span>
                  </div>
                </div>

                {summary.topSubreddits.length > 0 && (
                  <div className="flex items-start gap-3">
                    <Users className="w-4 h-4 text-primary mt-0.5" />
                    <div className="text-sm">
                      <span className="text-foreground">Top communities: </span>
                      <span className="text-muted-foreground font-mono">
                        {summary.topSubreddits.map(s => `r/${s}`).join(', ')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="space-y-4">
        {topPosts.map((post, index) => {
          const engagementScore = getEngagementScore(post);
          const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: false });
          const isSaved = isPostSaved(post.id);
          
          return (
            <div
              key={post.id}
              className="border border-border/50 rounded-lg p-4 bg-background/30 hover:bg-background/50 transition-colors"
            >
              {/* Header Row */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Rank indicator */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">#{index + 1}</span>
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 -ml-1 flex-shrink-0"
                        onClick={() => handleBookmark(post)}
                      >
                        <Bookmark 
                          className={`w-4 h-4 transition-colors ${
                            isSaved 
                              ? 'fill-foreground text-foreground' 
                              : 'text-muted-foreground hover:text-foreground'
                          }`} 
                        />
                      </Button>
                      <h4 className="font-semibold text-foreground leading-tight">
                        {post.title.length > 70 ? `${post.title.slice(0, 70)}...` : post.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs border-orange-500/50 text-orange-400 bg-orange-500/10">
                        r/{post.parsedCommunityName}
                      </Badge>
                      {post.flair && (
                        <Badge variant="secondary" className="text-xs">
                          {post.flair}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Engagement Score */}
                <div className="text-right flex-shrink-0">
                  <div className={`text-2xl font-bold ${getEngagementColor(engagementScore)}`}>
                    {engagementScore >= 100 ? engagementScore.toFixed(0) : engagementScore.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                    <TrendingUp className="w-3 h-3" />
                    engagement/hr
                  </div>
                </div>
              </div>
              
              {/* Summary */}
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {generateSummary(post)}
              </p>
              
              {/* Stats Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ArrowBigUp className="w-4 h-4 text-orange-500" />
                    <span className="font-medium text-foreground">{post.upVotes.toLocaleString()}</span>
                    <span>upvotes</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-4 h-4" />
                    <span>{post.numberOfComments}</span>
                    <span>comments</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{timeAgo}</span>
                  </span>
                </div>
                
                {/* Action Links */}
                <div className="flex items-center gap-3 text-sm">
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Post
                  </a>
                  <a
                    href={`https://www.reddit.com/user/${post.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <Avatar className="w-4 h-4">
                      <AvatarFallback className="text-[8px] bg-muted">
                        {post.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {post.username}
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
