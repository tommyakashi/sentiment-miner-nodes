import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
import { aggregateNodeAnalysis } from '@/utils/sentiment/analyzers/sentimentAnalyzer';
import { parseRedditJSON, extractTimeSeriesData } from '@/utils/redditParser';
import type { Node, SentimentResult, NodeAnalysis } from '@/types/sentiment';
import type { RedditData } from '@/types/reddit';
import { Brain, BarChart3, Settings, Download } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [results, setResults] = useState<SentimentResult[]>([]);
  const [nodeAnalysis, setNodeAnalysis] = useState<NodeAnalysis[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [trendingThemes, setTrendingThemes] = useState<any[]>([]);
  const [overallSentiment, setOverallSentiment] = useState<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sources, setSources] = useState<Array<{ name: string; value: number }>>([]);
  const { toast } = useToast();

  // Server-side sentiment analysis using Edge Function
  const analyzeSentimentWithEdgeFunction = async (
    texts: string[],
    nodes: Node[],
    onProgress: (progress: number) => void,
    onStatus: (status: string) => void
  ): Promise<SentimentResult[]> => {
    const chunkSize = 100; // Process 100 texts at a time
    const allResults: SentimentResult[] = [];

    for (let i = 0; i < texts.length; i += chunkSize) {
      const chunk = texts.slice(i, i + chunkSize);
      const chunkNumber = Math.floor(i / chunkSize) + 1;
      const totalChunks = Math.ceil(texts.length / chunkSize);
      
      onStatus(`Processing batch ${chunkNumber} of ${totalChunks}...`);
      
      try {
        const { data, error } = await supabase.functions.invoke('analyze-sentiment-batch', {
          body: { texts: chunk, nodes }
        });

        if (error) throw error;
        
        if (data?.results) {
          allResults.push(...data.results);
        }

        const currentProgress = Math.min(((i + chunk.length) / texts.length) * 100, 100);
        onProgress(currentProgress);
      } catch (error) {
        console.error(`Error processing chunk ${chunkNumber}:`, error);
        toast({
          title: 'Batch processing error',
          description: `Failed to process batch ${chunkNumber}. Retrying...`,
          variant: 'destructive',
        });
        
        // Retry once
        try {
          const { data, error: retryError } = await supabase.functions.invoke('analyze-sentiment-batch', {
            body: { texts: chunk, nodes }
          });
          
          if (!retryError && data?.results) {
            allResults.push(...data.results);
          }
        } catch (retryErr) {
          console.error('Retry failed:', retryErr);
        }
      }

      // Small delay between chunks to avoid rate limiting
      if (i + chunkSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return allResults;
  };

  // Check auth status
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/auth');
      } else {
        setIsCheckingAuth(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          navigate('/auth');
        } else {
          setIsCheckingAuth(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

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

    try {
      let textsToAnalyze: string[] = [];
      let rawData: RedditData[] = [];

      if (fileType === 'reddit') {
        rawData = content as RedditData[];
        const parsed = parseRedditJSON(rawData);
        textsToAnalyze = parsed.allText;

      // Process participants with initial data
      const participantsList = Array.from(parsed.participants.values())
        .sort((a, b) => b.totalUpvotes - a.totalUpvotes)
        .slice(0, 10);

      // Batch all state updates related to Reddit data
      const timeSeries = extractTimeSeriesData(rawData);
      const sourceData = [{ name: 'Reddit', value: textsToAnalyze.length }];

      // Update all Reddit-related state in one batch
      Promise.resolve().then(() => {
        setTimeSeriesData(timeSeries);
        setParticipants(participantsList);
        setSources(sourceData);
      });

        toast({
          title: 'Reddit data loaded',
          description: `Processing ${parsed.posts.length} posts and ${parsed.comments.length} comments`,
        });
      } else {
        textsToAnalyze = content;
        const sourceData = [{ name: 'Text/Other', value: textsToAnalyze.length }];
        setSources(sourceData);
      }

      // Analyze sentiment using Edge Function (server-side processing)
      setAnalysisStatus('Sending data to analysis server...');
      const analysisResults = await analyzeSentimentWithEdgeFunction(
        textsToAnalyze, 
        nodes, 
        (progress) => setProgress(progress),
        (status) => setAnalysisStatus(status)
      );

      // Calculate all derived data before updating state
      const avgSentiment = analysisResults.reduce((sum, r) => sum + r.polarityScore, 0) / analysisResults.length;
      const nodeAnalysisData = aggregateNodeAnalysis(analysisResults);

      // Optimize participant sentiment calculation - build text-to-result map once
      let participantsWithSentiment = participants;
      if (participants.length > 0) {
        // Create a Map for O(1) lookup by text
        const textToResult = new Map(
          analysisResults.map(r => [r.text, r])
        );

        participantsWithSentiment = participants.map(p => {
          // Build list of relevant results for this participant
          const userResults: SentimentResult[] = [];
          for (const result of analysisResults) {
            if (result.text.includes(p.username)) {
              userResults.push(result);
            }
          }
          
          const avgSent = userResults.length > 0
            ? userResults.reduce((sum, r) => sum + r.polarityScore, 0) / userResults.length * 100
            : 0;
          return { ...p, sentimentScore: avgSent };
        });
      }

      // Batch all core analysis state updates together
      Promise.resolve().then(() => {
        setResults(analysisResults);
        setOverallSentiment(avgSentiment * 100);
        setNodeAnalysis(nodeAnalysisData);
        if (participantsWithSentiment.length > 0) {
          setParticipants(participantsWithSentiment);
        }
      });

      // Extract trending themes with AI (non-blocking, runs in background)
      setAnalysisStatus('Extracting themes with AI...');
      supabase.functions.invoke('extract-themes', {
        body: { texts: textsToAnalyze }
      }).then(({ data, error }) => {
        if (error) {
          console.error('Error extracting themes:', error);
          setTrendingThemes([]);
        } else if (data?.themes) {
          setTrendingThemes(data.themes);
        }
      }).catch(error => {
        console.error('Error extracting themes:', error);
        setTrendingThemes([]);
      });

      toast({
        title: 'Analysis complete',
        description: `Successfully analyzed ${textsToAnalyze.length} texts across ${nodeAnalysisData.length} topics.`,
      });
      
      // Switch to dashboard only after analysis is complete
      setActiveTab('dashboard');
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
      setAnalysisStatus('');
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-16 h-16 mx-auto text-primary mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

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
            <div className="mt-2 text-center">
              <p className="text-sm font-medium text-foreground">
                {analysisStatus || 'Analyzing sentiment...'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round(progress)}% complete
              </p>
            </div>
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
