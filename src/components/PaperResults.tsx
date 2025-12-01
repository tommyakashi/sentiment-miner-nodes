import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Bookmark, 
  ExternalLink, 
  Quote, 
  Users, 
  Calendar,
  TrendingUp,
  Star,
  FileText
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { AcademicPaper } from '@/types/paper';

interface PaperResultsProps {
  papers: AcademicPaper[];
  title?: string;
  showAll?: boolean;
}

export function PaperResults({ papers, title = "Top Papers", showAll = false }: PaperResultsProps) {
  const getSourceBadge = (paper: AcademicPaper) => {
    const source = (paper as any).source || 'semantic_scholar';
    if (source === 'arxiv') {
      return (
        <Badge variant="outline" className="text-xs border-orange-500/50 text-orange-400 bg-orange-500/10">
          arXiv
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400 bg-blue-500/10">
        Semantic Scholar
      </Badge>
    );
  };

  const getImportanceColor = (score: number) => {
    if (score >= 100) return 'text-emerald-400';
    if (score >= 50) return 'text-blue-400';
    if (score >= 20) return 'text-amber-400';
    return 'text-muted-foreground';
  };

  const formatCitations = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  // Sort by importance and take top 10 or all
  const displayPapers = showAll 
    ? papers 
    : [...papers]
        .sort((a, b) => ((b as any).importanceScore || 0) - ((a as any).importanceScore || 0))
        .slice(0, 10);

  if (displayPapers.length === 0) return null;

  return (
    <Card className="p-6 bg-card/60 backdrop-blur-sm border-border/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <Badge variant="secondary" className="font-mono">
          {papers.length} papers
        </Badge>
      </div>
      
      <div className="space-y-4">
        {displayPapers.map((paper, index) => {
          const importanceScore = (paper as any).importanceScore || 0;
          const timeAgo = paper.publicationDate 
            ? formatDistanceToNow(new Date(paper.publicationDate), { addSuffix: false })
            : paper.year ? `${paper.year}` : 'Unknown';
          
          return (
            <div
              key={paper.paperId}
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
                      <h4 className="font-semibold text-foreground leading-tight">
                        {paper.title.length > 80 ? `${paper.title.slice(0, 80)}...` : paper.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {getSourceBadge(paper)}
                      {paper.venue && (
                        <Badge variant="secondary" className="text-xs">
                          {paper.venue.length > 30 ? `${paper.venue.slice(0, 30)}...` : paper.venue}
                        </Badge>
                      )}
                      {paper.fieldsOfStudy && paper.fieldsOfStudy.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {paper.fieldsOfStudy[0]}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Importance Score */}
                <div className="text-right flex-shrink-0">
                  <div className={`text-2xl font-bold ${getImportanceColor(importanceScore)}`}>
                    {importanceScore >= 100 ? importanceScore.toFixed(0) : importanceScore.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                    <TrendingUp className="w-3 h-3" />
                    importance
                  </div>
                </div>
              </div>
              
              {/* TLDR or Abstract Summary */}
              {(paper.tldr || paper.abstract) && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {paper.tldr || paper.abstract.slice(0, 200) + '...'}
                </p>
              )}
              
              {/* Stats Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Quote className="w-4 h-4 text-emerald-500" />
                    <span className="font-medium text-foreground">{formatCitations(paper.citationCount)}</span>
                    <span>citations</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{paper.authors.length}</span>
                    <span>authors</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{timeAgo}</span>
                  </span>
                </div>
                
                {/* Action Links */}
                <div className="flex items-center gap-3 text-sm">
                  <a
                    href={paper.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Read
                  </a>
                  {paper.authors.length > 0 && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {paper.authors[0].name}
                      {paper.authors.length > 1 && ` +${paper.authors.length - 1}`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
