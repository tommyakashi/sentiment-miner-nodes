import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  ExternalLink, 
  Quote, 
  Users, 
  Calendar,
  TrendingUp,
  FileText,
  ChevronDown,
  Info,
  BarChart3,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import type { AcademicPaper } from '@/types/paper';

interface PaperResultsProps {
  papers: AcademicPaper[];
  title?: string;
  showAll?: boolean;
}

// Generate collection summary
const generateCollectionSummary = (papers: AcademicPaper[]) => {
  if (papers.length === 0) return null;

  // Calculate stats
  const totalCitations = papers.reduce((sum, p) => sum + p.citationCount, 0);
  const avgCitations = totalCitations / papers.length;
  const maxCitations = Math.max(...papers.map(p => p.citationCount));
  const minYear = Math.min(...papers.filter(p => p.year).map(p => p.year));
  const maxYear = Math.max(...papers.filter(p => p.year).map(p => p.year));
  
  // Count sources
  const arxivCount = papers.filter(p => p.source === 'arxiv').length;
  const ssCount = papers.filter(p => p.source === 'semantic_scholar').length;
  
  // Extract top fields
  const fieldCounts: Record<string, number> = {};
  papers.forEach(p => {
    p.fieldsOfStudy?.forEach(field => {
      fieldCounts[field] = (fieldCounts[field] || 0) + 1;
    });
  });
  const topFields = Object.entries(fieldCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([field]) => field);

  // Extract top venues
  const venueCounts: Record<string, number> = {};
  papers.forEach(p => {
    if (p.venue) {
      venueCounts[p.venue] = (venueCounts[p.venue] || 0) + 1;
    }
  });
  const topVenues = Object.entries(venueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([venue]) => venue);

  // Find highly cited papers (top 10%)
  const citationThreshold = papers.length > 10 
    ? papers.sort((a, b) => b.citationCount - a.citationCount)[Math.floor(papers.length * 0.1)]?.citationCount || 100
    : 50;
  const highlyCited = papers.filter(p => p.citationCount >= citationThreshold).length;

  // Recent papers (last 2 years)
  const currentYear = new Date().getFullYear();
  const recentPapers = papers.filter(p => p.year >= currentYear - 2).length;

  return {
    totalCitations,
    avgCitations: Math.round(avgCitations),
    maxCitations,
    yearRange: minYear === maxYear ? `${minYear}` : `${minYear}–${maxYear}`,
    arxivCount,
    ssCount,
    topFields,
    topVenues,
    highlyCited,
    recentPapers,
    recentPercent: Math.round((recentPapers / papers.length) * 100)
  };
};

export function PaperResults({ papers, title = "Top Papers", showAll = false }: PaperResultsProps) {
  const [scoringOpen, setScoringOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);

  const getSourceBadge = (paper: AcademicPaper) => {
    const source = paper.source || 'semantic_scholar';
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

  const summary = generateCollectionSummary(papers);

  if (displayPapers.length === 0) return null;

  return (
    <Card className="p-6 bg-card/60 backdrop-blur-sm border-border/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <Badge variant="secondary" className="font-mono">
          {papers.length} papers
        </Badge>
      </div>

      {/* Scoring Methodology - Collapsible */}
      <Collapsible open={scoringOpen} onOpenChange={setScoringOpen} className="mb-4">
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-between p-3 rounded-lg border border-border/50 bg-background/30">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4" />
            <span className="font-medium">How is Importance Scored?</span>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${scoringOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="p-4 rounded-lg border border-border/50 bg-background/50 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="w-4 h-4 text-primary" />
              Importance Score Formula
            </div>
            
            <div className="font-mono text-sm bg-muted/50 p-3 rounded-md border border-border/30">
              <div className="text-muted-foreground mb-2">// Base calculation</div>
              <div><span className="text-emerald-400">citationScore</span> = log₁₀(citations + 1) × 20</div>
              <div><span className="text-blue-400">influentialScore</span> = influentialCitations × 2</div>
              <div><span className="text-amber-400">recencyBonus</span> = (currentYear - year) {"<"} 2 ? 15 : 0</div>
              <div className="mt-2 pt-2 border-t border-border/30">
                <span className="text-primary font-semibold">importanceScore</span> = citationScore + influentialScore + recencyBonus
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                <div className="font-medium text-emerald-400">Citations (40%)</div>
                <div className="text-xs text-muted-foreground">Logarithmic scale rewards highly-cited papers while preventing outliers from dominating</div>
              </div>
              <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
                <div className="font-medium text-blue-400">Influential Citations (35%)</div>
                <div className="text-xs text-muted-foreground">Citations from papers that significantly built upon this work (Semantic Scholar metric)</div>
              </div>
              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20">
                <div className="font-medium text-amber-400">Recency (25%)</div>
                <div className="text-xs text-muted-foreground">Bonus for papers published in the last 2 years to surface emerging research</div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border/30">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Score ≥100 = High impact
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Score 50-99 = Notable
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Score 20-49 = Emerging
              </span>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

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
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-center">
                  <div className="text-2xl font-bold text-primary">{summary.totalCitations.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total Citations</div>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
                  <div className="text-2xl font-bold text-emerald-400">{summary.avgCitations}</div>
                  <div className="text-xs text-muted-foreground">Avg Citations</div>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-center">
                  <div className="text-2xl font-bold text-blue-400">{summary.highlyCited}</div>
                  <div className="text-xs text-muted-foreground">Highly Cited</div>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-center">
                  <div className="text-2xl font-bold text-amber-400">{summary.recentPercent}%</div>
                  <div className="text-xs text-muted-foreground">Recent (2yr)</div>
                </div>
              </div>

              {/* Insights */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <BookOpen className="w-4 h-4 text-primary mt-0.5" />
                  <div className="text-sm">
                    <span className="text-foreground">This collection spans </span>
                    <span className="font-medium text-primary">{summary.yearRange}</span>
                    <span className="text-foreground">, with </span>
                    <span className="font-medium text-emerald-400">{summary.recentPapers} papers</span>
                    <span className="text-foreground"> from the last 2 years representing emerging AI research trends.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Quote className="w-4 h-4 text-primary mt-0.5" />
                  <div className="text-sm">
                    <span className="text-foreground">The most cited paper has </span>
                    <span className="font-medium text-primary">{summary.maxCitations.toLocaleString()} citations</span>
                    <span className="text-foreground">. </span>
                    <span className="font-medium text-blue-400">{summary.highlyCited} papers</span>
                    <span className="text-foreground"> are classified as highly influential based on citation impact.</span>
                  </div>
                </div>

                {/* Sources */}
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 text-primary mt-0.5" />
                  <div className="text-sm">
                    <span className="text-foreground">Sources: </span>
                    {summary.ssCount > 0 && (
                      <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400 bg-blue-500/10 mr-1">
                        Semantic Scholar ({summary.ssCount})
                      </Badge>
                    )}
                    {summary.arxivCount > 0 && (
                      <Badge variant="outline" className="text-xs border-orange-500/50 text-orange-400 bg-orange-500/10">
                        arXiv ({summary.arxivCount})
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Top Fields */}
                {summary.topFields.length > 0 && (
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-4 h-4 text-primary mt-0.5" />
                    <div className="text-sm">
                      <span className="text-foreground">Primary research domains: </span>
                      <span className="text-muted-foreground">
                        {summary.topFields.join(', ')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Top Venues */}
                {summary.topVenues.length > 0 && (
                  <div className="flex items-start gap-3">
                    <Users className="w-4 h-4 text-primary mt-0.5" />
                    <div className="text-sm">
                      <span className="text-foreground">Notable venues: </span>
                      <span className="text-muted-foreground">
                        {summary.topVenues.map(v => v.length > 40 ? v.slice(0, 40) + '...' : v).join(', ')}
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
        {displayPapers.map((paper, index) => {
          const importanceScore = paper.importanceScore || 0;
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
