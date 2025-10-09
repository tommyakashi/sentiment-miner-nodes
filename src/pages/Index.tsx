import { useState } from 'react';
import { NodeManager } from '@/components/NodeManager';
import { FileUploader } from '@/components/FileUploader';
import { SentimentScore } from '@/components/SentimentScore';
import { SentimentChart } from '@/components/SentimentChart';
import { ParticipantsList } from '@/components/ParticipantsList';
import { TopicsList } from '@/components/TopicsList';
import { TrendingThemes } from '@/components/TrendingThemes';
import { ResultsTable } from '@/components/ResultsTable';
import { KPISortableTable } from '@/components/KPISortableTable';
import { KPIRadarChart } from '@/components/KPIRadarChart';
import { KPIHeatmap } from '@/components/KPIHeatmap';
import { ExemplarQuotes } from '@/components/ExemplarQuotes';
import { SourceDistribution } from '@/components/SourceDistribution';
import { ConfidenceDistribution } from '@/components/ConfidenceDistribution';
import { InsightBox } from '@/components/InsightBox';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { analyzeSentiment, extractKeywords } from '@/utils/sentimentAnalyzer';
import { parseRedditJSON, extractTimeSeriesData } from '@/utils/redditParser';
import type { Node, SentimentResult, NodeAnalysis } from '@/types/sentiment';
import type { RedditData } from '@/types/reddit';
import { Brain, BarChart3, Settings, Download } from 'lucide-react';

const Index = () => {
  const [nodes, setNodes] = useState<Node[]>([
    { id: '1', name: 'Market Sentiment', keywords: ['bullish', 'bearish', 'rally', 'crash', 'gain', 'loss'] },
    { id: '2', name: 'Tech Stocks', keywords: ['tech', 'tsla', 'aapl', 'nvda', 'meta', 'googl'] },
    { id: '3', name: 'Economic Policy', keywords: ['fed', 'interest', 'inflation', 'economy', 'policy', 'rates'] },
    { id: '4', name: 'Trading Strategy', keywords: ['calls', 'puts', 'yolo', 'strategy', 'trade', 'option'] },
  ]);
  const [results, setResults] = useState<SentimentResult[]>([]);
  const [nodeAnalysis, setNodeAnalysis] = useState<NodeAnalysis[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [trendingThemes, setTrendingThemes] = useState<any[]>([]);
  const [overallSentiment, setOverallSentiment] = useState<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sources, setSources] = useState<Array<{ name: string; value: number }>>([]);
  const { toast } = useToast();

  const handleFilesChange = async (content: any[], fileType: 'reddit' | 'text') => {
    if (content.length === 0) {
      // Clear all data when no files
      setResults([]);
      setNodeAnalysis([]);
      setTimeSeriesData([]);
      setParticipants([]);
      setTrendingThemes([]);
      setOverallSentiment(0);
      return;
    }
    if (nodes.length === 0) {
      toast({
        title: 'No nodes defined',
        description: 'Please define at least one analysis node before analyzing data.',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);
    setActiveTab('dashboard');

    try {
      let textsToAnalyze: string[] = [];
      let rawData: RedditData[] = [];

      if (fileType === 'reddit') {
        rawData = content as RedditData[];
        const parsed = parseRedditJSON(rawData);
        textsToAnalyze = parsed.allText;

        // Extract time series
        const timeSeries = extractTimeSeriesData(rawData);
        setTimeSeriesData(timeSeries);

        // Process participants
        const participantsList = Array.from(parsed.participants.values())
          .sort((a, b) => b.totalUpvotes - a.totalUpvotes)
          .slice(0, 10);
        setParticipants(participantsList);

        toast({
          title: 'Reddit data loaded',
          description: `Processing ${parsed.posts.length} posts and ${parsed.comments.length} comments`,
        });
      } else {
        textsToAnalyze = content;
      }

      // Track sources
      const sourceData = fileType === 'reddit' 
        ? [{ name: 'Reddit', value: textsToAnalyze.length }]
        : [{ name: 'Text/Other', value: textsToAnalyze.length }];
      setSources(sourceData);
      const analysisResults = await analyzeSentiment(textsToAnalyze, nodes, setProgress);
      setResults(analysisResults);

      // Calculate overall sentiment
      const avgSentiment = analysisResults.reduce((sum, r) => sum + r.polarityScore, 0) / analysisResults.length;
      setOverallSentiment(avgSentiment * 100);

      // Calculate node-level aggregates
      const nodeMap = new Map<string, SentimentResult[]>();
      analysisResults.forEach(result => {
        const existing = nodeMap.get(result.nodeId) || [];
        nodeMap.set(result.nodeId, [...existing, result]);
      });

      const analysis: NodeAnalysis[] = Array.from(nodeMap.entries()).map(([nodeId, results]) => {
        const node = nodes.find(n => n.id === nodeId)!;
        const totalTexts = results.length;
        
        const avgPolarity = results.reduce((sum, r) => sum + r.polarityScore, 0) / totalTexts;
        
        const avgKpiScores = {
          trust: results.reduce((sum, r) => sum + r.kpiScores.trust, 0) / totalTexts,
          optimism: results.reduce((sum, r) => sum + r.kpiScores.optimism, 0) / totalTexts,
          frustration: results.reduce((sum, r) => sum + r.kpiScores.frustration, 0) / totalTexts,
          clarity: results.reduce((sum, r) => sum + r.kpiScores.clarity, 0) / totalTexts,
          access: results.reduce((sum, r) => sum + r.kpiScores.access, 0) / totalTexts,
          fairness: results.reduce((sum, r) => sum + r.kpiScores.fairness, 0) / totalTexts,
        };

        const sentimentDistribution = {
          positive: results.filter(r => r.polarity === 'positive').length,
          neutral: results.filter(r => r.polarity === 'neutral').length,
          negative: results.filter(r => r.polarity === 'negative').length,
        };

        return {
          nodeId,
          nodeName: node.name,
          totalTexts,
          avgPolarity,
          avgKpiScores,
          sentimentDistribution,
        };
      });

      setNodeAnalysis(analysis);

      // Update participant sentiments
      if (participants.length > 0) {
        const participantsWithSentiment = participants.map(p => {
          const userTexts = analysisResults.filter(r => r.text.includes(p.username));
          const avgSent = userTexts.length > 0
            ? userTexts.reduce((sum, r) => sum + r.polarityScore, 0) / userTexts.length * 100
            : 0;
          return { ...p, sentimentScore: avgSent };
        });
        setParticipants(participantsWithSentiment);
      }

      // Extract trending themes with AI
      const allText = textsToAnalyze.join(' ');
      const keywords = await extractKeywords(allText, 20);
      const themes = keywords.map(word => {
        const wordTexts = analysisResults.filter(r => r.text.toLowerCase().includes(word));
        const sentiment = wordTexts.length > 0
          ? wordTexts.reduce((sum, r) => sum + r.polarityScore, 0) / wordTexts.length
          : 0;
        return {
          word,
          frequency: wordTexts.length,
          sentiment,
        };
      });
      setTrendingThemes(themes);

      toast({
        title: 'Analysis complete',
        description: `Successfully analyzed ${textsToAnalyze.length} texts across ${nodeMap.size} topics.`,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: 'Analysis failed',
        description: 'An error occurred during sentiment analysis.',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
      setProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="container mx-auto px-4 py-6 max-w-[1600px]">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary rounded-lg">
                <Brain className="w-8 h-8 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Sentiment Insights</h1>
                <p className="text-sm text-muted-foreground">
                  Multi-node analysis with KPI scoring
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {isAnalyzing && (
          <div className="mb-6">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Analyzing sentiment... {Math.round(progress)}%
            </p>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="setup" className="gap-2">
              <Settings className="w-4 h-4" />
              Setup
            </TabsTrigger>
            <TabsTrigger value="details" className="gap-2">
              Details
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {results.length === 0 ? (
              <div className="text-center py-12">
                <Brain className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Analysis Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Upload data in the Setup tab to begin analysis
                </p>
                <Button onClick={() => setActiveTab('setup')}>
                  Go to Setup
                </Button>
              </div>
            ) : (
              <>
                {/* BIG SCORE - Full Width Banner */}
                <div className="w-full">
                  <SentimentScore 
                    score={overallSentiment} 
                    label="Overall Sentiment Index" 
                  />
                </div>

                {/* Time Series Chart */}
                {timeSeriesData.length > 0 && (
                  <SentimentChart
                    data={timeSeriesData}
                    title="Sentiment and Volume over time"
                  />
                )}

                {/* KPI Sortable Table */}
                {nodeAnalysis.length > 0 && (
                  <>
                    <InsightBox
                      title="Understanding Node-Level KPI Analysis"
                      insights={[
                        'Each row represents one of your analysis topics with quantitative scores',
                        'Polarity ranges from -1 (negative) to +1 (positive) - shows overall sentiment',
                        'KPI scores measure specific qualities: Trust, Optimism, Frustration, Clarity, Access, and Fairness',
                        'Distribution shows count of positive (+), neutral (=), and negative (-) mentions',
                        'Click column headers to sort and find strongest/weakest areas'
                      ]}
                    />
                    <KPISortableTable data={nodeAnalysis} />
                  </>
                )}

                {/* Two Column Grid for Visualizations */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Radar Chart */}
                  {nodeAnalysis.length > 0 && (
                    <>
                      <div className="lg:col-span-2">
                        <InsightBox
                          title="Understanding KPI Comparison"
                          insights={[
                            'The radar chart shows how your top 5 topics perform across all 6 KPIs',
                            'Larger, more filled shapes indicate stronger scores across multiple metrics',
                            'Compare shapes to see which topics have similar or different patterns',
                            'Look for topics that excel in specific areas vs. those with balanced scores'
                          ]}
                        />
                      </div>
                      <KPIRadarChart data={nodeAnalysis} />
                    </>
                  )}

                  {/* Source Distribution */}
                  {sources.length > 0 && (
                    <>
                      <InsightBox
                        title="Understanding Data Sources"
                        insights={[
                          'Shows where your analyzed content came from (Reddit, PDFs, text files, etc.)',
                          'Useful for understanding if sentiment patterns differ by source type',
                          'Larger slices indicate more data from that source',
                          'Consider balancing sources if one dominates the analysis'
                        ]}
                      />
                      <SourceDistribution sources={sources} />
                    </>
                  )}

                  {/* Heatmap spans full width if odd number */}
                  {nodeAnalysis.length > 0 && (
                    <div className="lg:col-span-2">
                      <InsightBox
                        title="Understanding KPI Heatmap"
                        insights={[
                          'Color-coded grid for quick visual comparison of all topics and KPIs',
                          'Green cells = positive/strong scores, Red = negative/weak, Gray = neutral',
                          'Scan rows to see topic strengths/weaknesses across all metrics',
                          'Scan columns to compare how all topics perform on a specific KPI',
                          'Look for patterns: Are certain KPIs consistently high/low across topics?'
                        ]}
                      />
                      <KPIHeatmap data={nodeAnalysis} />
                    </div>
                  )}

                  {/* Confidence Distribution */}
                  {results.length > 0 && (
                    <ConfidenceDistribution results={results} />
                  )}

                  {/* Trending Themes */}
                  {trendingThemes.length > 0 && (
                    <TrendingThemes themes={trendingThemes} />
                  )}

                  {/* Participants */}
                  {participants.length > 0 && (
                    <ParticipantsList
                      participants={participants}
                      title="Top Participants"
                    />
                  )}

                  {/* Topics */}
                  {nodeAnalysis.length > 0 && (
                    <TopicsList topics={nodeAnalysis} />
                  )}
                </div>

                {/* Exemplar Quotes - Show top 3 nodes */}
                {nodeAnalysis.slice(0, 3).map((node) => (
                  <ExemplarQuotes
                    key={node.nodeId}
                    results={results}
                    nodeId={node.nodeId}
                    nodeName={node.nodeName}
                  />
                ))}
              </>
            )}
          </TabsContent>

          {/* Setup Tab */}
          <TabsContent value="setup" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FileUploader onFilesChange={handleFilesChange} disabled={isAnalyzing} />
              <NodeManager nodes={nodes} onNodesChange={setNodes} />
            </div>
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details">
            {results.length > 0 ? (
              <ResultsTable results={results} nodeAnalysis={nodeAnalysis} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No detailed results available yet
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
