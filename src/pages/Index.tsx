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
import { InsightButton } from '@/components/InsightButton';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { performSentimentAnalysis, aggregateNodeAnalysis } from '@/utils/sentiment/analyzers/sentimentAnalyzer';
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
  const [stagedContent, setStagedContent] = useState<any[]>([]);
  const [stagedFileType, setStagedFileType] = useState<'reddit' | 'text'>('text');
  const [stagedFileCount, setStagedFileCount] = useState<number>(0);
  const [isDataReady, setIsDataReady] = useState(false);
  const [modelsPreloaded, setModelsPreloaded] = useState(false);
  const { toast } = useToast();

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

  const handleFilesLoaded = async (content: any[], fileType: 'reddit' | 'text', fileCount: number) => {
    if (content.length === 0) {
      // Clear staged data when no files
      setStagedContent([]);
      setStagedFileType('text');
      setStagedFileCount(0);
      setIsDataReady(false);
      setModelsPreloaded(false);
      setResults([]);
      setNodeAnalysis([]);
      setTimeSeriesData([]);
      setParticipants([]);
      setTrendingThemes([]);
      setOverallSentiment(0);
      return;
    }
    
    // Stage the data without analyzing
    setStagedContent(content);
    setStagedFileType(fileType);
    setStagedFileCount(fileCount);
    setIsDataReady(true);
    
    // Preload models when files are uploaded for faster analysis
    if (!modelsPreloaded) {
      setAnalysisStatus('Preloading AI models...');
      try {
        const { initializeSentimentModel } = await import('@/utils/sentiment/models/sentimentModel');
        const { initializeEmbeddingModel } = await import('@/utils/sentiment/models/embeddingModel');
        
        // Initialize models with timeout
        const modelTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Model loading timeout')), 60000)
        );
        
        await Promise.race([
          Promise.all([
            initializeSentimentModel(),
            initializeEmbeddingModel(),
          ]),
          modelTimeout
        ]);
        
        setModelsPreloaded(true);
        setAnalysisStatus('');
        toast({
          title: 'Ready to analyze',
          description: `AI models loaded • ${fileCount} file(s) staged`,
        });
      } catch (error) {
        console.error('Failed to preload models:', error);
        setAnalysisStatus('');
        setModelsPreloaded(false);
        toast({
          title: 'Model loading failed',
          description: 'Models will load when you start analysis. This may take a moment.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleStartAnalysis = async () => {
    if (stagedContent.length === 0) {
      toast({
        title: 'No data loaded',
        description: 'Please upload files before starting analysis.',
        variant: 'destructive',
      });
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
      let participantsList: any[] = [];

      // Step 1: Parse and prepare data
      if (stagedFileType === 'reddit') {
        rawData = stagedContent as RedditData[];
        const parsed = parseRedditJSON(rawData);
        textsToAnalyze = parsed.allText;

        // Process participants
        participantsList = Array.from(parsed.participants.values())
          .sort((a, b) => b.totalUpvotes - a.totalUpvotes)
          .slice(0, 10);

        // Extract time series data
        const timeSeries = extractTimeSeriesData(rawData);
        const sourceData = [{ name: 'Reddit', value: textsToAnalyze.length }];

        // Update Reddit-specific state synchronously
        setTimeSeriesData(timeSeries);
        setParticipants(participantsList);
        setSources(sourceData);

        toast({
          title: 'Reddit data loaded',
          description: `Processing ${parsed.posts.length} posts and ${parsed.comments.length} comments`,
        });
      } else {
        textsToAnalyze = stagedContent;
        const sourceData = [{ name: 'Text/Other', value: textsToAnalyze.length }];
        setSources(sourceData);
      }

      // Step 2: Perform sentiment analysis
      setAnalysisStatus('Initializing sentiment analysis models...');
      const analysisResults = await performSentimentAnalysis(
        textsToAnalyze, 
        nodes,
        (progress) => setProgress(progress),
        (status) => setAnalysisStatus(status)
      );

      // Step 3: Calculate derived metrics
      const avgSentiment = analysisResults.reduce((sum, r) => sum + r.polarityScore, 0) / analysisResults.length;
      const nodeAnalysisData = aggregateNodeAnalysis(analysisResults);

      // Step 4: Calculate participant sentiment scores (if applicable)
      let participantsWithSentiment = participantsList;
      if (participantsList.length > 0) {
        // Build reverse index: username -> results (O(n) single pass)
        const participantIndex = new Map<string, SentimentResult[]>();
        
        analysisResults.forEach(result => {
          const lowerText = result.text.toLowerCase();
          participantsList.forEach(p => {
            if (lowerText.includes(p.username.toLowerCase())) {
              if (!participantIndex.has(p.username)) {
                participantIndex.set(p.username, []);
              }
              participantIndex.get(p.username)!.push(result);
            }
          });
        });

        // Calculate sentiment scores using index
        participantsWithSentiment = participantsList.map(p => {
          const userResults = participantIndex.get(p.username) || [];
          const avgSent = userResults.length > 0
            ? userResults.reduce((sum, r) => sum + r.polarityScore, 0) / userResults.length * 100
            : 0;
          return { ...p, sentimentScore: avgSent };
        });
      }

      // Step 5: Update all analysis results synchronously
      setResults(analysisResults);
      setOverallSentiment(avgSentiment * 100);
      setNodeAnalysis(nodeAnalysisData);
      if (participantsWithSentiment.length > 0) {
        setParticipants(participantsWithSentiment);
      }
      setTrendingThemes([]);

      // Step 6: Show completion and switch to dashboard
      toast({
        title: 'Analysis complete',
        description: `Successfully analyzed ${textsToAnalyze.length} texts across ${nodeAnalysisData.length} topics.`,
      });
      
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
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">Node-Level KPI Analysis</h3>
                      <InsightButton
                        title="How to read this"
                        insights={[
                          'Each row represents one of your analysis topics with quantitative scores',
                          'Polarity ranges from -1 (negative) to +1 (positive) - shows overall sentiment',
                          'KPI scores measure specific qualities: Trust, Optimism, Frustration, Clarity, Access, and Fairness',
                          'Distribution shows count of positive (+), neutral (=), and negative (-) mentions',
                          'Click column headers to sort and find strongest/weakest areas'
                        ]}
                      />
                    </div>
                    <KPISortableTable data={nodeAnalysis} />
                  </div>
                )}

                {/* Two Column Grid for Visualizations */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Radar Chart */}
                  {nodeAnalysis.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">KPI Comparison</h3>
                        <InsightButton
                          title="How to read this"
                          insights={[
                            'The radar chart shows how your top 5 topics perform across all 6 KPIs',
                            'Larger, more filled shapes indicate stronger scores across multiple metrics',
                            'Compare shapes to see which topics have similar or different patterns',
                            'Look for topics that excel in specific areas vs. those with balanced scores'
                          ]}
                        />
                      </div>
                      <KPIRadarChart data={nodeAnalysis} />
                    </div>
                  )}

                  {/* Source Distribution */}
                  {sources.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">Data Sources</h3>
                        <InsightButton
                          title="How to read this"
                          insights={[
                            'Shows where your analyzed content came from (Reddit, PDFs, text files, etc.)',
                            'Useful for understanding if sentiment patterns differ by source type',
                            'Larger slices indicate more data from that source',
                            'Consider balancing sources if one dominates the analysis'
                          ]}
                        />
                      </div>
                      <SourceDistribution sources={sources} />
                    </div>
                  )}

                  {/* Heatmap spans full width if odd number */}
                  {nodeAnalysis.length > 0 && (
                    <div className="lg:col-span-2 space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">KPI Heatmap</h3>
                        <InsightButton
                          title="How to read this"
                          insights={[
                            'Color-coded grid for quick visual comparison of all topics and KPIs',
                            'Green cells = positive/strong scores, Red = negative/weak, Gray = neutral',
                            'Scan rows to see topic strengths/weaknesses across all metrics',
                            'Scan columns to compare how all topics perform on a specific KPI',
                            'Look for patterns: Are certain KPIs consistently high/low across topics?'
                          ]}
                        />
                      </div>
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
            {/* Start Analysis Button */}
            {isDataReady && (
              <div className="bg-primary/10 border-2 border-primary/20 rounded-lg p-6 text-center">
                <div className="mb-4">
                  <p className="text-lg font-semibold mb-2">
                    📊 {stagedFileCount} source{stagedFileCount !== 1 ? 's' : ''} loaded ({stagedContent.length} items)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {nodes.length > 0 
                      ? `Ready to analyze across ${nodes.length} node(s)`
                      : 'Define at least one analysis node below to begin'
                    }
                  </p>
                </div>
                <Button
                  onClick={handleStartAnalysis}
                  disabled={isAnalyzing || nodes.length === 0}
                  size="lg"
                  className="gap-2"
                >
                  <Brain className="w-5 h-5" />
                  Start Analysis
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FileUploader onFilesLoaded={handleFilesLoaded} disabled={isAnalyzing} />
              <NodeManager nodes={nodes} onNodesChange={setNodes} />
            </div>
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details">
            {results.length > 0 ? (
              <ResultsTable 
                results={results} 
                nodeAnalysis={nodeAnalysis}
                nodes={nodes}
                overallSentiment={overallSentiment}
                totalTexts={results.length}
                sources={sources}
              />
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
