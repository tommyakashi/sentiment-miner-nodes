import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { NodeManager } from '@/components/NodeManager';
import { RedditScraper } from '@/components/RedditScraper';
import { ScrapeHistory } from '@/components/ScrapeHistory';
import { PaperScraper } from '@/components/PaperScraper';
import { PaperHistory } from '@/components/PaperHistory';
import { PaperResults } from '@/components/PaperResults';
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
import AnimatedLogo from '@/components/AnimatedLogo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { performSentimentAnalysisServer, aggregateNodeAnalysis } from '@/utils/sentiment/analyzers/sentimentAnalyzer';
import { parseRedditJSON, extractTimeSeriesData } from '@/utils/redditParser';
import type { Node, SentimentResult, NodeAnalysis } from '@/types/sentiment';
import type { RedditData, RedditPost } from '@/types/reddit';
import type { AcademicPaper } from '@/types/paper';
import { Activity, Zap, BookOpen } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const [introFading, setIntroFading] = useState(false);
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
  const [scrapedPapers, setScrapedPapers] = useState<AcademicPaper[]>([]);
  const [paperResults, setPaperResults] = useState<SentimentResult[]>([]);
  const [paperNodeAnalysis, setPaperNodeAnalysis] = useState<NodeAnalysis[]>([]);
  const [paperOverallSentiment, setPaperOverallSentiment] = useState<number>(0);
  const [isPaperDataReady, setIsPaperDataReady] = useState(false);
  const { toast } = useToast();

  // Intro splash screen timer - starts pitch black, logo fades in
  const [logoVisible, setLogoVisible] = useState(false);
  
  useEffect(() => {
    if (!isCheckingAuth && showIntro) {
      // Logo fades in after brief black screen
      const showLogoTimer = setTimeout(() => {
        setLogoVisible(true);
      }, 300); // Brief black pause
      
      const fadeTimer = setTimeout(() => {
        setIntroFading(true);
      }, 3200); // Start fading at 3.2s (giving logo 2.9s visible)
      
      const hideTimer = setTimeout(() => {
        setShowIntro(false);
        setIntroFading(false);
      }, 4700); // Hide at 4.7s (1.5s fade duration)
      
      return () => {
        clearTimeout(showLogoTimer);
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [isCheckingAuth, showIntro]);
  
  const TOTAL_STEPS = 5;

  // Default nodes configuration
  const DEFAULT_NODES: Node[] = [
    { id: '1', name: 'Funding Outlook & Sustainability', keywords: [] },
    { id: '2', name: 'Open Science & Transparency', keywords: [] },
    { id: '3', name: 'Collaboration & Community', keywords: [] },
    { id: '4', name: 'Institutional Trust', keywords: [] },
    { id: '5', name: 'Administrative Load', keywords: [] },
    { id: '6', name: 'Technological Enablement', keywords: [] },
    { id: '7', name: 'Future of AI & U.S. vs China Race', keywords: [] },
    { id: '8', name: 'Ethical Responsibility', keywords: [] },
    { id: '9', name: 'Career Outlook & Researcher Well-being', keywords: [] },
    { id: '10', name: 'Impact & Recognition', keywords: [] },
  ];

  // Load nodes from localStorage on mount
  useEffect(() => {
    const savedNodes = localStorage.getItem('sentiment-nodes');
    if (savedNodes) {
      try {
        const parsed = JSON.parse(savedNodes);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNodes(parsed);
        } else {
          setNodes(DEFAULT_NODES);
          localStorage.setItem('sentiment-nodes', JSON.stringify(DEFAULT_NODES));
        }
      } catch (error) {
        console.error('Error loading saved nodes:', error);
        setNodes(DEFAULT_NODES);
        localStorage.setItem('sentiment-nodes', JSON.stringify(DEFAULT_NODES));
      }
    } else {
      setNodes(DEFAULT_NODES);
      localStorage.setItem('sentiment-nodes', JSON.stringify(DEFAULT_NODES));
    }
  }, []);

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

    // Step 1: Initializing - fade out window FIRST, show loading overlay
    setCurrentStep(1);
    setProgress(0);
    setAnalysisStatus('Initializing...');
    setIsWindowHiding(true);
    
    // Wait for fade-out animation to complete
    await new Promise(resolve => setTimeout(resolve, 300));
    setShowWindow(false);
    setIsWindowHiding(false);
    
    // NOW show the loading overlay (after window is hidden)
    setIsAnalyzing(true);
    
    // Small delay to ensure React renders the overlay
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      let textsToAnalyze: string[] = [];
      let rawData: RedditData[] = [];
      let participantsList: any[] = [];

      // Step 2: Preparing data
      setCurrentStep(2);
      setAnalysisStatus('Preparing data...');
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

      // Step 3: Sending to AI
      setCurrentStep(3);
      setAnalysisStatus('Sending to AI...');
      setProgress(20);

      // Step 4: Analyzing sentiment (server-side)
      setCurrentStep(4);
      const analysisResults = await performSentimentAnalysisServer(
        textsToAnalyze, 
        nodes,
        (progress) => setProgress(20 + progress * 0.65),
        (status) => setAnalysisStatus(status)
      );

      // Step 5: Aggregating results
      setCurrentStep(5);
      setAnalysisStatus('Aggregating results...');
      setProgress(90);

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

      // Only switch to analysis tab if we got results
      setActiveTab('analysis');

    } catch (error) {
      console.error('Analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during sentiment analysis.';
      toast({
        title: 'Analysis failed',
        description: errorMessage,
        variant: 'destructive',
      });
      // Stay on current tab if analysis failed - don't switch to empty analysis
    } finally {
      setIsAnalyzing(false);
      setShowWindow(true);
      setProgress(0);
      setCurrentStep(1);
      setAnalysisStatus('');
    }
  };

  const handlePapersLoaded = (papers: AcademicPaper[]) => {
    setScrapedPapers(papers);
    setIsPaperDataReady(papers.length > 0);
    if (papers.length > 0) {
      toast({
        title: 'Papers loaded',
        description: `${papers.length} papers ready for analysis`,
      });
    }
  };

  const handleStartPaperAnalysis = async () => {
    if (scrapedPapers.length === 0) {
      toast({
        title: 'No papers loaded',
        description: 'Search for papers first.',
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

    setCurrentStep(1);
    setProgress(0);
    setAnalysisStatus('Initializing paper analysis...');
    setIsWindowHiding(true);
    
    await new Promise(resolve => setTimeout(resolve, 300));
    setShowWindow(false);
    setIsWindowHiding(false);
    setIsAnalyzing(true);
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      setCurrentStep(2);
      setAnalysisStatus('Extracting paper texts...');
      setProgress(10);

      const textsToAnalyze = scrapedPapers.map(p => p.combinedText).filter(t => t.length > 0);
      
      setCurrentStep(3);
      setAnalysisStatus('Sending to AI...');
      setProgress(20);

      setCurrentStep(4);
      const analysisResults = await performSentimentAnalysisServer(
        textsToAnalyze, 
        nodes,
        (progress) => setProgress(20 + progress * 0.65),
        (status) => setAnalysisStatus(status)
      );

      setCurrentStep(5);
      setAnalysisStatus('Aggregating results...');
      setProgress(90);

      const avgSentiment = analysisResults.reduce((sum, r) => sum + r.polarityScore, 0) / analysisResults.length;
      const nodeAnalysisData = aggregateNodeAnalysis(analysisResults);

      setProgress(100);
      setPaperResults(analysisResults);
      setPaperOverallSentiment(avgSentiment * 100);
      setPaperNodeAnalysis(nodeAnalysisData);

      toast({
        title: 'Paper analysis complete',
        description: `Analyzed ${textsToAnalyze.length} papers across ${nodeAnalysisData.length} topics.`,
      });

      setActiveTab('papers-analysis');

    } catch (error) {
      console.error('Paper analysis error:', error);
      toast({
        title: 'Analysis failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
      setShowWindow(true);
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

  // Intro splash screen with animated logo - starts pitch black
  if (showIntro) {
    return (
      <div className={`min-h-screen bg-black flex items-center justify-center relative overflow-hidden transition-opacity duration-[1500ms] ${introFading ? 'opacity-0' : 'opacity-100'}`}>
        <div className={`text-center z-10 transition-opacity duration-1000 ${logoVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="scale-[3]">
            <AnimatedLogo />
          </div>
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
              <Card className="p-4 border-border/50 bg-background/30">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-sm font-mono">
                        <span className="text-foreground font-semibold">{stagedContent.length}</span>
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
                    className="gap-2"
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
          <ScrollArea className="h-[450px]">
            <div className="p-4 space-y-3">
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
                    <KPISortableTable data={nodeAnalysis} />
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {nodeAnalysis.length > 0 && <KPIRadarChart data={nodeAnalysis} />}
                    {sources.length > 0 && <SourceDistribution sources={sources} />}
                    {results.length > 0 && <ConfidenceDistribution results={results} />}
                    {nodeAnalysis.length > 0 && <TopicsList topics={nodeAnalysis} />}
                    {participants.length > 0 && (
                      <ParticipantsList participants={participants} title="Contributors" />
                    )}
                    {nodeAnalysis.length > 0 && <KPIHeatmap data={nodeAnalysis} />}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {nodeAnalysis.slice(0, 3).map((node) => (
                      <ExemplarQuotes
                        key={node.nodeId}
                        results={results}
                        nodeId={node.nodeId}
                        nodeName={node.nodeName}
                      />
                    ))}
                  </div>
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

      case 'papers':
        return (
          <div className="p-6 space-y-6">
            <PaperScraper 
              onDataScraped={handlePapersLoaded}
              nodes={nodes}
            />

            {isPaperDataReady && (
              <Card className="p-4 border-border/50 bg-background/30">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                      <span className="text-sm font-mono">
                        <span className="text-foreground font-semibold">{scrapedPapers.length}</span>
                        <span className="text-muted-foreground"> papers ready</span>
                      </span>
                    </div>
                    <div className="text-sm font-mono text-muted-foreground">
                      {nodes.length} nodes configured
                    </div>
                  </div>
                  <Button
                    onClick={handleStartPaperAnalysis}
                    disabled={isAnalyzing || nodes.length === 0}
                    className="gap-2"
                  >
                    <BookOpen className="w-4 h-4" />
                    Analyze Papers
                  </Button>
                </div>
              </Card>
            )}

            {scrapedPapers.length > 0 && (
              <PaperResults 
                papers={scrapedPapers}
                title="Scraped AI Papers"
              />
            )}
          </div>
        );

      case 'papers-archive':
        return (
          <div className="p-6">
            <PaperHistory 
              onLoadScrape={(papers) => {
                handlePapersLoaded(papers);
                setActiveTab('papers');
              }}
            />
          </div>
        );

      case 'papers-analysis':
        return (
          <ScrollArea className="h-[450px]">
            <div className="p-4 space-y-3">
              {paperResults.length > 0 ? (
                <>
                  <SentimentScore 
                    score={paperOverallSentiment} 
                    label="Academic Sentiment Index" 
                  />

                  {paperNodeAnalysis.length > 0 && (
                    <KPISortableTable data={paperNodeAnalysis} />
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {paperNodeAnalysis.length > 0 && <KPIRadarChart data={paperNodeAnalysis} />}
                    <SourceDistribution sources={[{ name: 'Semantic Scholar', value: scrapedPapers.length }]} />
                    {paperResults.length > 0 && <ConfidenceDistribution results={paperResults} />}
                    {paperNodeAnalysis.length > 0 && <TopicsList topics={paperNodeAnalysis} />}
                    {paperNodeAnalysis.length > 0 && <KPIHeatmap data={paperNodeAnalysis} />}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {paperNodeAnalysis.slice(0, 3).map((node) => (
                      <ExemplarQuotes
                        key={node.nodeId}
                        results={paperResults}
                        nodeId={node.nodeId}
                        nodeName={node.nodeName}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-16">
                  <BookOpen className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Paper Analysis Results</h3>
                  <p className="text-muted-foreground text-sm">
                    Search for papers and run analysis to see results here.
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setActiveTab('papers')}
                  >
                    Go to Paper Scanner
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
        totalTexts={stagedContent.length}
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
