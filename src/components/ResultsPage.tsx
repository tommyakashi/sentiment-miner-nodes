import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SentimentScore } from '@/components/SentimentScore';
import { SentimentChart } from '@/components/SentimentChart';
import { KPISortableTable } from '@/components/KPISortableTable';
import { KPIRadarChart } from '@/components/KPIRadarChart';
import { KPIHeatmap } from '@/components/KPIHeatmap';
import { ExemplarQuotes } from '@/components/ExemplarQuotes';
import { SourceDistribution } from '@/components/SourceDistribution';
import { ConfidenceDistribution } from '@/components/ConfidenceDistribution';
import { TopicsList } from '@/components/TopicsList';
import { ScoreExplanation } from '@/components/ScoreExplanation';
import { Home, Archive, Radio, BookOpen } from 'lucide-react';
import type { SentimentResult, NodeAnalysis } from '@/types/sentiment';

interface ResultsPageProps {
  sourceType: 'reddit' | 'papers';
  overallSentiment: number;
  results: SentimentResult[];
  nodeAnalysis: NodeAnalysis[];
  timeSeriesData?: any[];
  sources: Array<{ name: string; value: number }>;
  onGoHome: () => void;
  onViewArchive: () => void;
}

export function ResultsPage({
  sourceType,
  overallSentiment,
  results,
  nodeAnalysis,
  timeSeriesData = [],
  sources,
  onGoHome,
  onViewArchive,
}: ResultsPageProps) {
  const isReddit = sourceType === 'reddit';

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
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
                {isReddit ? 'Reddit' : 'Academic Papers'} Analysis
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onViewArchive} className="gap-2">
            <Archive className="w-4 h-4" />
            View Past Results
          </Button>
        </div>
      </div>

      {/* Results Content */}
      <ScrollArea className="h-[calc(100vh-65px)]">
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
          {results.length > 0 ? (
            <>
              {/* Overall Score with Explanation */}
              <div className="space-y-4">
                <SentimentScore 
                  score={overallSentiment} 
                  label={isReddit ? "Community Sentiment Index" : "Academic Sentiment Index"} 
                />
                <ScoreExplanation score={overallSentiment} />
              </div>

              {/* Time Series Chart (Reddit only) */}
              {isReddit && timeSeriesData.length > 0 && (
                <SentimentChart
                  data={timeSeriesData}
                  title="Temporal Analysis"
                />
              )}

              {/* KPI Table */}
              {nodeAnalysis.length > 0 && (
                <KPISortableTable data={nodeAnalysis} />
              )}

              {/* Charts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {nodeAnalysis.length > 0 && <KPIRadarChart data={nodeAnalysis} />}
                {sources.length > 0 && <SourceDistribution sources={sources} />}
                {results.length > 0 && <ConfidenceDistribution results={results} />}
                {nodeAnalysis.length > 0 && <TopicsList topics={nodeAnalysis} />}
              </div>

              {/* Heatmap */}
              {nodeAnalysis.length > 0 && <KPIHeatmap data={nodeAnalysis} />}

              {/* Exemplar Quotes */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold font-mono">Key Quotes by Topic</h3>
                <div className="grid grid-cols-1 gap-4">
                  {nodeAnalysis.slice(0, 5).map((node) => (
                    <ExemplarQuotes
                      key={node.nodeId}
                      results={results}
                      nodeId={node.nodeId}
                      nodeName={node.nodeName}
                    />
                  ))}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-center gap-4 pt-8 pb-4">
                <Button variant="outline" onClick={onGoHome} className="gap-2">
                  <Home className="w-4 h-4" />
                  New Analysis
                </Button>
                <Button variant="ghost" onClick={onViewArchive} className="gap-2">
                  <Archive className="w-4 h-4" />
                  View Archive
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto bg-muted/20 rounded-full flex items-center justify-center mb-4">
                {isReddit ? (
                  <Radio className="w-8 h-8 text-muted-foreground/30" />
                ) : (
                  <BookOpen className="w-8 h-8 text-muted-foreground/30" />
                )}
              </div>
              <h3 className="text-lg font-semibold mb-2">No Results Available</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Something went wrong during analysis.
              </p>
              <Button variant="outline" onClick={onGoHome}>
                Try Again
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
