import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { NodeManager } from '@/components/NodeManager';
import { RedditScraper } from '@/components/RedditScraper';
import { ScrapeHistory } from '@/components/ScrapeHistory';
import { SentimentScore } from '@/components/SentimentScore';
import { SentimentChart } from '@/components/SentimentChart';
import { ParticipantsList } from '@/components/ParticipantsList';
import { TopicsList } from '@/components/TopicsList';
import { KPISortableTable } from '@/components/KPISortableTable';
import { KPIRadarChart } from '@/components/KPIRadarChart';
import { KPIHeatmap } from '@/components/KPIHeatmap';
import { ExemplarQuotes } from '@/components/ExemplarQuotes';
import { SourceDistribution } from '@/components/SourceDistribution';
import { ConfidenceDistribution } from '@/components/ConfidenceDistribution';
import { TopPosts } from '@/components/TopPosts';
import { InsightButton } from '@/components/InsightButton';
import { ParticleBackground } from '@/components/ParticleBackground';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { performSentimentAnalysis, aggregateNodeAnalysis } from '@/utils/sentiment/analyzers/sentimentAnalyzer';
import { parseRedditJSON, extractTimeSeriesData } from '@/utils/redditParser';
import type { Node, SentimentResult, NodeAnalysis } from '@/types/sentiment';
import type { RedditData, RedditPost } from '@/types/reddit';
import { Activity, ChevronDown, ChevronUp, Settings2, Zap } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [results, setResults] = useState<SentimentResult[]>([]);
  const [nodeAnalysis, setNodeAnalysis] = useState<NodeAnalysis[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [overallSentiment, setOverallSentiment] = useState<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');
  const [sources, setSources] = useState<Array<{ name: string; value: number }>>([]);
  const [stagedContent, setStagedContent] = useState<any[]>([]);
  const [isDataReady, setIsDataReady] = useState(false);
  const [modelsPreloaded, setModelsPreloaded] = useState(false);
  const [showNodeConfig, setShowNodeConfig] = useState(false);
  const [scrapedPosts, setScrapedPosts] = useState<RedditPost[]>([]);
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
      setStagedContent([]);
      setIsDataReady(false);
      setModelsPreloaded(false);
      setResults([]);
      setNodeAnalysis([]);
      setTimeSeriesData([]);
      setParticipants([]);
      setOverallSentiment(0);
      setScrapedPosts([]);
      return;
    }
    
    setStagedContent(content);
    setIsDataReady(true);
    
    // Extract posts for TopPosts component
    const posts = content.filter((item: any) => item.dataType === 'post') as RedditPost[];
    setScrapedPosts(posts);
    
    // Preload models
    if (!modelsPreloaded) {
      setAnalysisStatus('Preloading AI models...');
      try {
        const { initializeSentimentModel } = await import('@/utils/sentiment/models/sentimentModel');
        const { initializeEmbeddingModel } = await import('@/utils/sentiment/models/embeddingModel');
        
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
          description: `AI models loaded • ${content.length} items staged`,
        });
      } catch (error) {
        console.error('Failed to preload models:', error);
        setAnalysisStatus('');
        setModelsPreloaded(false);
      }
    }
  };

  const handleStartAnalysis = async () => {
    if (stagedContent.length === 0) {
      toast({
        title: 'No data loaded',
        description: 'Scrape Reddit data first.',
        variant: 'destructive',
      });
      return;
    }
    if (nodes.length === 0) {
      toast({
        title: 'No nodes defined',
        description: 'Configure analysis nodes first.',
        variant: 'destructive',
      });
      setShowNodeConfig(true);
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);

    try {
      let textsToAnalyze: string[] = [];
      let rawData: RedditData[] = [];
      let participantsList: any[] = [];

      // Parse Reddit data
      rawData = stagedContent as RedditData[];
      
      const isValidReddit = rawData.length > 0 && 
        rawData.some((item: any) => 
          item && typeof item === 'object' && 
          ('text' in item || 'body' in item || 'title' in item) &&
          'createdAt' in item
        );

      if (isValidReddit) {
        const parsed = parseRedditJSON(rawData);
        textsToAnalyze = parsed.allText;

        participantsList = Array.from(parsed.participants.values())
          .sort((a, b) => b.totalUpvotes - a.totalUpvotes)
          .slice(0, 10);
        
        const sourceData = [{ name: 'Reddit', value: textsToAnalyze.length }];
        setSources(sourceData);
        setParticipants(participantsList);
      } else {
        textsToAnalyze = stagedContent as string[];
        setSources([{ name: 'Text/Other', value: textsToAnalyze.length }]);
      }

      // Perform sentiment analysis
      setAnalysisStatus('Analyzing sentiment...');
      const analysisResults = await performSentimentAnalysis(
        textsToAnalyze, 
        nodes,
        (progress) => setProgress(progress),
        (status) => setAnalysisStatus(status)
      );

      // Calculate time series
      if (rawData.length > 0) {
        try {
          const timeSeries = extractTimeSeriesData(rawData, analysisResults);
          setTimeSeriesData(timeSeries);
        } catch (timeError) {
          console.error('Error extracting time series:', timeError);
          setTimeSeriesData([]);
        }
      }

      // Calculate metrics
      const avgSentiment = analysisResults.reduce((sum, r) => sum + r.polarityScore, 0) / analysisResults.length;
      const nodeAnalysisData = aggregateNodeAnalysis(analysisResults);

      // Calculate participant sentiment
      if (participantsList.length > 0) {
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

        const participantsWithSentiment = participantsList.map(p => {
          const userResults = participantIndex.get(p.username) || [];
          const avgSent = userResults.length > 0
            ? userResults.reduce((sum, r) => sum + r.polarityScore, 0) / userResults.length * 100
            : 0;
          return { ...p, sentimentScore: avgSent };
        });
        setParticipants(participantsWithSentiment);
      }

      setResults(analysisResults);
      setOverallSentiment(avgSentiment * 100);
      setNodeAnalysis(nodeAnalysisData);

      toast({
        title: 'Analysis complete',
        description: `Analyzed ${textsToAnalyze.length} texts across ${nodeAnalysisData.length} topics.`,
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
      setAnalysisStatus('');
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
        <ParticleBackground particleCount={30} interactive={false} />
        <div className="text-center z-10">
          <div className="relative">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center animate-pulse">
              <Activity className="w-10 h-10 text-primary-foreground" />
            </div>
            <div className="absolute inset-0 w-20 h-20 mx-auto rounded-full bg-primary/20 animate-ping" />
          </div>
          <p className="text-muted-foreground mt-6 font-mono text-sm">Initializing observatory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Particle Background */}
      <ParticleBackground 
        particleCount={40} 
        interactive={true} 
        dataCount={stagedContent.length} 
      />
      
      {/* Grid Overlay */}
      <div className="fixed inset-0 observatory-grid pointer-events-none z-0" />
      
      {/* Main Content */}
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8 max-w-[1600px]">
          {/* Header */}
          <header className="mb-8 animate-fade-in-up">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="p-4 bg-gradient-to-br from-primary to-accent rounded-xl glow-primary">
                  <Activity className="w-8 h-8 text-primary-foreground" />
                </div>
                {isDataReady && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-sentiment-positive rounded-full status-dot status-dot-positive" />
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  <span className="gradient-text">Research Sentiment</span>
                  <span className="text-foreground"> Observatory</span>
                </h1>
                <p className="text-sm text-muted-foreground font-mono mt-1">
                  Real-time sentiment analysis • Academic & AI communities
                </p>
              </div>
            </div>
          </header>

          {/* Progress Bar */}
          {isAnalyzing && (
            <div className="mb-8 animate-fade-in-up">
              <Card className="p-4 border-primary/30 bg-card/80 backdrop-blur-sm">
                <Progress value={progress} className="h-2 mb-3" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary animate-pulse" />
                    <p className="text-sm font-medium text-foreground">
                      {analysisStatus || 'Processing signals...'}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {Math.round(progress)}%
                  </p>
                </div>
              </Card>
            </div>
          )}

          {/* Main Scraper Interface */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 stagger-children">
            <RedditScraper 
              onDataScraped={(data) => {
                handleFilesLoaded(data, 'reddit', 1);
              }} 
            />
            <ScrapeHistory 
              onLoadScrape={(data) => {
                handleFilesLoaded(data, 'reddit', 1);
              }}
            />
          </div>

          {/* Analysis Controls */}
          {isDataReady && (
            <Card className="p-4 mb-8 border-primary/20 bg-card/80 backdrop-blur-sm animate-fade-in-up">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="status-dot status-dot-positive" />
                    <span className="text-sm font-mono">
                      <span className="text-primary font-semibold">{stagedContent.length}</span>
                      <span className="text-muted-foreground"> signals</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <span className="text-sm font-mono">
                      <span className="text-accent font-semibold">{nodes.length}</span>
                      <span className="text-muted-foreground"> nodes</span>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNodeConfig(!showNodeConfig)}
                    className="gap-2 border-border/50 hover:border-primary/50 hover:bg-primary/5"
                  >
                    <Settings2 className="w-4 h-4" />
                    Configure
                    {showNodeConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                  <Button
                    onClick={handleStartAnalysis}
                    disabled={isAnalyzing || nodes.length === 0}
                    className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
                  >
                    <Zap className="w-4 h-4" />
                    Analyze
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Node Configuration (Collapsible) */}
          <Collapsible open={showNodeConfig} onOpenChange={setShowNodeConfig}>
            <CollapsibleContent className="mb-8">
              <div className="animate-fade-in-up">
                <NodeManager nodes={nodes} onNodesChange={setNodes} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Top Posts Section */}
          {scrapedPosts.length > 0 && (
            <div className="mb-8 animate-fade-in-up">
              <TopPosts posts={scrapedPosts} title="Trending Signals" />
            </div>
          )}

          {/* Results Section */}
          {results.length > 0 && (
            <div className="space-y-8 stagger-children">
              {/* Overall Sentiment Score */}
              <SentimentScore 
                score={overallSentiment} 
                label="Composite Sentiment Index" 
              />

              {/* Time Series Chart */}
              {timeSeriesData.length > 0 && (
                <SentimentChart
                  data={timeSeriesData}
                  title="Temporal Analysis"
                />
              )}

              {/* KPI Table */}
              {nodeAnalysis.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Node-Level KPI Analysis</h3>
                    <InsightButton
                      title="Interpretation Guide"
                      insights={[
                        'Each row represents one analysis topic with scores',
                        'Polarity: -1.0 (negative) to +1.0 (positive)',
                        'KPI scores show sentiment intensity for each dimension',
                        'Click headers to sort'
                      ]}
                    />
                  </div>
                  <KPISortableTable data={nodeAnalysis} />
                </div>
              )}

              {/* Visualizations Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {nodeAnalysis.length > 0 && (
                  <KPIRadarChart data={nodeAnalysis} />
                )}

                {sources.length > 0 && (
                  <SourceDistribution sources={sources} />
                )}

                {nodeAnalysis.length > 0 && (
                  <div className="lg:col-span-2">
                    <KPIHeatmap data={nodeAnalysis} />
                  </div>
                )}

                {results.length > 0 && (
                  <ConfidenceDistribution results={results} />
                )}

                {participants.length > 0 && (
                  <ParticipantsList
                    participants={participants}
                    title="Top Contributors"
                  />
                )}

                {nodeAnalysis.length > 0 && (
                  <TopicsList topics={nodeAnalysis} />
                )}
              </div>

              {/* Exemplar Quotes */}
              {nodeAnalysis.slice(0, 3).map((node) => (
                <ExemplarQuotes
                  key={node.nodeId}
                  results={results}
                  nodeId={node.nodeId}
                  nodeName={node.nodeName}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isDataReady && results.length === 0 && (
            <Card className="p-16 text-center border-dashed border-2 border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in-up">
              <div className="relative inline-block mb-6">
                <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
                  <Activity className="w-10 h-10 text-muted-foreground" />
                </div>
                <div className="absolute inset-0 w-20 h-20 rounded-full border border-primary/20 animate-ping" style={{ animationDuration: '3s' }} />
              </div>
              <h3 className="text-xl font-semibold mb-3">Observatory Standing By</h3>
              <p className="text-muted-foreground max-w-md mx-auto font-mono text-sm">
                Select a time range and initiate a scrape to collect signals from 39 research communities. 
                Then run analysis to visualize sentiment patterns.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
