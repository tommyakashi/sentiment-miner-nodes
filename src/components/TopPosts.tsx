import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bookmark, ArrowBigUp, MessageSquare, Clock, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useSavedPosts } from '@/hooks/useSavedPosts';
import type { RedditPost } from '@/types/reddit';

// Generate a brief summary from post title and body
const generateSummary = (post: RedditPost): string => {
  const title = post.title.toLowerCase();
  const body = post.body?.toLowerCase() || '';
  
  // Extract key themes
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
  
  // Build summary
  if (themes.length > 0) {
    return `Post ${themes.slice(0, 2).join(' and ')}. ${post.numberOfComments} community responses.`;
  }
  
  // Fallback: truncate body or use generic
  if (post.body && post.body.length > 20) {
    return post.body.slice(0, 100).trim() + '...';
  }
  
  return `Discussion with ${post.numberOfComments} community responses.`;
};

interface TopPostsProps {
  posts: RedditPost[];
  title?: string;
}

export function TopPosts({ posts, title = "Top Posts" }: TopPostsProps) {
  const { toast } = useToast();
  const { isPostSaved, toggleSavePost } = useSavedPosts();

  // Calculate engagement score for sorting
  const getEngagementScore = (post: RedditPost): number => {
    const ageInHours = Math.max(1, (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60));
    // Weight: upvotes (if available) + comments*3 (comments indicate discussion)
    const engagement = post.upVotes > 0 
      ? (post.upVotes + post.numberOfComments * 3) 
      : (post.numberOfComments * 5); // No upvotes = weight comments more
    return engagement / ageInHours;
  };

  // Sort by engagement score (works with or without upvotes)
  const topPosts = [...posts]
    .map(post => ({ ...post, score: getEngagementScore(post) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

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
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="space-y-4">
        {topPosts.map((post) => {
          const engagementScore = getEngagementScore(post);
          const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: false });
          const isSaved = isPostSaved(post.id);
          
          return (
            <div
              key={post.id}
              className="border border-border rounded-lg p-4 bg-card/50 hover:bg-card/80 transition-colors"
            >
              {/* Header Row */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 -ml-1 mt-0.5 flex-shrink-0"
                    onClick={() => handleBookmark(post)}
                  >
                    <Bookmark 
                      className={`w-5 h-5 transition-colors ${
                        isSaved 
                          ? 'fill-foreground text-foreground' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`} 
                    />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="font-semibold text-foreground truncate max-w-[400px]">
                        {post.title.length > 60 ? `${post.title.slice(0, 60)}...` : post.title}
                      </h4>
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        {post.parsedCommunityName}
                      </Badge>
                      {post.flair && (
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {post.flair}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Engagement Score */}
                <div className="text-right flex-shrink-0">
                  <div className="text-2xl font-bold text-primary">
                    {engagementScore >= 100 ? engagementScore.toFixed(0) : engagementScore.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    engagement/hr
                  </div>
                </div>
              </div>
              
              {/* Summary */}
              <p className="text-sm text-muted-foreground mb-3">
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
