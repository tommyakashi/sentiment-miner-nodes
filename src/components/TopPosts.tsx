import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bookmark, Star, MessageSquare, Clock, ExternalLink, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { RedditPost } from '@/types/reddit';

interface TopPostsProps {
  posts: RedditPost[];
  title?: string;
}

export function TopPosts({ posts, title = "Top Posts" }: TopPostsProps) {
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

  if (topPosts.length === 0) return null;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="space-y-4">
        {topPosts.map((post, idx) => {
          const engagementScore = getEngagementScore(post);
          const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: false });
          
          return (
            <div
              key={post.id}
              className="border border-border rounded-lg p-4 bg-card/50 hover:bg-card/80 transition-colors"
            >
              {/* Header Row */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Bookmark className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
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
              
              {/* Description */}
              {post.body && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {post.body.slice(0, 150)}{post.body.length > 150 ? '...' : ''}
                </p>
              )}
              
              {/* Stats Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-amber-500" />
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
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <User className="w-3 h-3" />
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
