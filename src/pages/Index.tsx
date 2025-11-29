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
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { performSentimentAnalysis, aggregateNodeAnalysis } from '@/utils/sentiment/analyzers/sentimentAnalyzer';
import { parseRedditJSON, extractTimeSeriesData } from '@/utils/redditParser';
import type { Node, SentimentResult, NodeAnalysis } from '@/types/sentiment';
import type { RedditData, RedditPost } from '@/types/reddit';
import { Brain, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';

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
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary rounded-lg">
              <Brain className="w-8 h-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Research Sentiment Tracker</h1>
              <p className="text-sm text-muted-foreground">
                Real-time sentiment analysis across academic & AI communities
              </p>
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

        {/* Main Scraper Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
          <Card className="p-4 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="font-semibold text-primary">{stagedContent.length}</span>
                  <span className="text-muted-foreground"> items ready</span>
                </div>
                <div className="text-sm">
                  <span className="font-semibold">{nodes.length}</span>
                  <span className="text-muted-foreground"> analysis nodes</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNodeConfig(!showNodeConfig)}
                  className="gap-2"
                >
                  <Settings2 className="w-4 h-4" />
                  Configure Nodes
                  {showNodeConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
                <Button
                  onClick={handleStartAnalysis}
                  disabled={isAnalyzing || nodes.length === 0}
                  className="gap-2"
                >
                  <Brain className="w-4 h-4" />
                  Run Analysis
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Node Configuration (Collapsible) */}
        <Collapsible open={showNodeConfig} onOpenChange={setShowNodeConfig}>
          <CollapsibleContent className="mb-6">
            <NodeManager nodes={nodes} onNodesChange={setNodes} />
          </CollapsibleContent>
        </Collapsible>

        {/* Top Posts Section */}
        {scrapedPosts.length > 0 && (
          <div className="mb-6">
            <TopPosts posts={scrapedPosts} title="Trending Posts" />
          </div>
        )}

        {/* Results Section */}
        {results.length > 0 && (
          <div className="space-y-6">
            {/* Overall Sentiment Score */}
            <SentimentScore 
              score={overallSentiment} 
              label="Overall Sentiment Index" 
            />

            {/* Time Series Chart */}
            {timeSeriesData.length > 0 && (
              <SentimentChart
                data={timeSeriesData}
                title="Sentiment Over Time"
              />
            )}

            {/* KPI Table */}
            {nodeAnalysis.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">Node-Level KPI Analysis</h3>
                  <InsightButton
                    title="How to read this"
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
                  title="Top Participants"
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
          <Card className="p-12 text-center">
            <Brain className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Scrape Reddit to Get Started</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Select a time range above and click scrape to collect posts from 39 research and AI subreddits. 
              Then run analysis to see sentiment insights.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;
