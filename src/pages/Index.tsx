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
import { FloatingWindow } from '@/components/FloatingWindow';
import { WindowTabs, TabId } from '@/components/WindowTabs';
import { ModeSelector, ModeId } from '@/components/ModeSelector';
import { ManualUpload } from '@/components/ManualUpload';
import { AnalysisLoadingOverlay } from '@/components/AnalysisLoadingOverlay';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { performSentimentAnalysis, aggregateNodeAnalysis } from '@/utils/sentiment/analyzers/sentimentAnalyzer';
import { parseRedditJSON, extractTimeSeriesData } from '@/utils/redditParser';
import type { Node, SentimentResult, NodeAnalysis } from '@/types/sentiment';
import type { RedditData, RedditPost } from '@/types/reddit';
import { Activity, Zap } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [selectedMode, setSelectedMode] = useState<ModeId | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('scanner');
  const [isModeTransitioning, setIsModeTransitioning] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [results, setResults] = useState<SentimentResult[]>([]);
  const [nodeAnalysis, setNodeAnalysis] = useState<NodeAnalysis[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [overallSentiment, setOverallSentiment] = useState<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showWindow, setShowWindow] = useState(true);
  const [isWindowHiding, setIsWindowHiding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');
  const [sources, setSources] = useState<Array<{ name: string; value: number }>>([]);
  const [stagedContent, setStagedContent] = useState<any[]>([]);
  const [isDataReady, setIsDataReady] = useState(false);
  const [modelsPreloaded, setModelsPreloaded] = useState(false);
  const [scrapedPosts, setScrapedPosts] = useState<RedditPost[]>([]);
  const { toast } = useToast();
  
  const TOTAL_STEPS = 5;

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
    
    const posts = content.filter((item: any) => item.dataType === 'post') as RedditPost[];
    setScrapedPosts(posts);
    
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
        description: 'Configure analysis nodes in Settings.',
        variant: 'destructive',
      });
      setActiveTab('settings');
      return;
    }

    // Step 1: Initializing - fade out window
    setCurrentStep(1);
    setIsWindowHiding(true);
    setProgress(0);
    setAnalysisStatus('Initializing...');
    
    // Wait for fade-out animation
    await new Promise(resolve => setTimeout(resolve, 300));
    setShowWindow(false);
    setIsWindowHiding(false);
    setIsAnalyzing(true);

    try {
      let textsToAnalyze: string[] = [];
      let rawData: RedditData[] = [];
      let participantsList: any[] = [];

      // Step 2: Loading models
      setCurrentStep(2);
      setAnalysisStatus('Loading AI models...');
      setProgress(10);

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

      // Step 3: Processing embeddings
      setCurrentStep(3);
      setAnalysisStatus('Processing embeddings...');
      setProgress(20);

      // Step 4: Analyzing sentiment
      setCurrentStep(4);
      const analysisResults = await performSentimentAnalysis(
        textsToAnalyze, 
        nodes,
        (progress) => setProgress(20 + progress * 0.6),
        (status) => setAnalysisStatus(status)
      );

      // Step 5: Aggregating results
      setCurrentStep(5);
      setAnalysisStatus('Aggregating results...');
      setProgress(85);

      if (rawData.length > 0) {
        try {
          const timeSeries = extractTimeSeriesData(rawData, analysisResults);
          setTimeSeriesData(timeSeries);
        } catch (timeError) {
          console.error('Error extracting time series:', timeError);
          setTimeSeriesData([]);
        }
      }

      const avgSentiment = analysisResults.reduce((sum, r) => sum + r.polarityScore, 0) / analysisResults.length;
      const nodeAnalysisData = aggregateNodeAnalysis(analysisResults);

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

      setProgress(100);
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
      setShowWindow(true);
      setActiveTab('analysis');
      setProgress(0);
      setCurrentStep(1);
      setAnalysisStatus('');
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
        <ParticleBackground particleCount={50} interactive={false} />
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'scanner':
        return (
          <div className="p-6 space-y-6">
            {/* Scraper */}
            <RedditScraper 
              onDataScraped={(data) => {
                handleFilesLoaded(data, 'reddit', 1);
              }} 
            />

            {/* Analysis Controls */}
            {isDataReady && (
              <Card className="p-4 border-primary/20 bg-primary/5">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm font-mono">
                        <span className="text-primary font-semibold">{stagedContent.length}</span>
                        <span className="text-muted-foreground"> signals ready</span>
                      </span>
                    </div>
                    <div className="text-sm font-mono text-muted-foreground">
                      {nodes.length} nodes configured
                    </div>
                  </div>
                  <Button
                    onClick={handleStartAnalysis}
                    disabled={isAnalyzing || nodes.length === 0}
                    className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90"
                  >
                    <Zap className="w-4 h-4" />
                    Run Analysis
                  </Button>
                </div>
              </Card>
            )}

            {/* Top Posts */}
            {scrapedPosts.length > 0 && (
              <TopPosts posts={scrapedPosts} title="Trending Signals" />
            )}
          </div>
        );

      case 'archive':
        return (
          <div className="p-6">
            <ScrapeHistory 
              onLoadScrape={(data) => {
                handleFilesLoaded(data, 'reddit', 1);
                setActiveTab('scanner');
              }}
            />
          </div>
        );

      case 'analysis':
        return (
          <ScrollArea className="h-[600px]">
            <div className="p-6 space-y-6">
              {results.length > 0 ? (
                <>
                  <SentimentScore 
                    score={overallSentiment} 
                    label="Composite Sentiment Index" 
                  />

                  {timeSeriesData.length > 0 && (
                    <SentimentChart
                      data={timeSeriesData}
                      title="Temporal Analysis"
                    />
                  )}

                  {nodeAnalysis.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">Node-Level KPI Analysis</h3>
                        <InsightButton
                          title="Interpretation Guide"
                          insights={[
                            'Each row represents one analysis topic',
                            'Polarity: -1.0 (negative) to +1.0 (positive)',
                            'Click headers to sort'
                          ]}
                        />
                      </div>
                      <KPISortableTable data={nodeAnalysis} />
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {nodeAnalysis.length > 0 && <KPIRadarChart data={nodeAnalysis} />}
                    {sources.length > 0 && <SourceDistribution sources={sources} />}
                    {nodeAnalysis.length > 0 && (
                      <div className="lg:col-span-2">
                        <KPIHeatmap data={nodeAnalysis} />
                      </div>
                    )}
                    {results.length > 0 && <ConfidenceDistribution results={results} />}
                    {participants.length > 0 && (
                      <ParticipantsList participants={participants} title="Top Contributors" />
                    )}
                    {nodeAnalysis.length > 0 && <TopicsList topics={nodeAnalysis} />}
                  </div>

                  {nodeAnalysis.slice(0, 3).map((node) => (
                    <ExemplarQuotes
                      key={node.nodeId}
                      results={results}
                      nodeId={node.nodeId}
                      nodeName={node.nodeName}
                    />
                  ))}
                </>
              ) : (
                <div className="text-center py-16">
                  <Activity className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Analysis Results</h3>
                  <p className="text-muted-foreground text-sm">
                    Scrape data and run analysis to see results here.
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setActiveTab('scanner')}
                  >
                    Go to Scanner
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        );

      case 'upload':
        return (
          <div className="p-6">
            <ManualUpload 
              onDataReady={(content, fileType, fileCount) => {
                handleFilesLoaded(content, fileType, fileCount);
              }}
            />
          </div>
        );

      case 'settings':
        return (
          <div className="p-6">
            <NodeManager nodes={nodes} onNodesChange={setNodes} />
          </div>
        );

      default:
        return null;
    }
  };

  const handleModeSelect = (mode: ModeId) => {
    setIsModeTransitioning(true);
    
    // Small delay for fade out effect
    setTimeout(() => {
      setSelectedMode(mode);
      setActiveTab(mode as TabId);
      setIsModeTransitioning(false);
    }, 300);
  };

  const handleBackToHome = () => {
    setIsModeTransitioning(true);
    
    setTimeout(() => {
      setSelectedMode(null);
      setIsModeTransitioning(false);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
      {/* Full-screen Particle Background */}
      <ParticleBackground 
        particleCount={60} 
        interactive={true} 
        dataCount={stagedContent.length} 
      />
      
      {/* Subtle Grid Overlay */}
      <div className="fixed inset-0 observatory-grid pointer-events-none z-0 opacity-50" />
      
      {/* Analysis Loading Overlay */}
      <AnalysisLoadingOverlay 
        isVisible={isAnalyzing && !showWindow}
        progress={progress}
        status={analysisStatus}
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
      />
      
      {/* Mode Selector - shown when no mode is selected */}
      <div className={`transition-all duration-300 ${
        !selectedMode && !isModeTransitioning 
          ? 'opacity-100 scale-100' 
          : 'opacity-0 scale-95 pointer-events-none absolute'
      }`}>
        <ModeSelector 
          onSelectMode={handleModeSelect}
          isVisible={!selectedMode && !isModeTransitioning}
        />
      </div>
      
      {/* Floating Window - with fade animations */}
      {selectedMode && (showWindow || isWindowHiding) && (
        <div className={`relative z-10 w-full transition-all duration-300 ${
          isWindowHiding || isModeTransitioning
            ? 'opacity-0 scale-95' 
            : 'opacity-100 scale-100 animate-fade-in'
        }`}>
          <FloatingWindow
            header={
              <WindowTabs 
                activeTab={activeTab} 
                onTabChange={setActiveTab}
                dataCount={stagedContent.length}
                onBackToHome={handleBackToHome}
              />
            }
          >
            {renderTabContent()}
          </FloatingWindow>
        </div>
      )}
    </div>
  );
};

export default Index;
