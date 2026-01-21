import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { NodeSelectionPage } from '@/components/NodeSelectionPage';
import { SourceSelector, SourceType } from '@/components/SourceSelector';
import { RedditScraperSimplified } from '@/components/RedditScraperSimplified';
import { PaperScraperSimplified } from '@/components/PaperScraperSimplified';
import { ResultsPage } from '@/components/ResultsPage';
import { ArchivePage } from '@/components/ArchivePage';
import { AnalysisLoadingOverlay } from '@/components/AnalysisLoadingOverlay';
import AnimatedLogo from '@/components/AnimatedLogo';
import { ParticleBackground } from '@/components/ParticleBackground';
import { useToast } from '@/hooks/use-toast';
import { performSentimentAnalysisServer, aggregateNodeAnalysis } from '@/utils/sentiment/analyzers/sentimentAnalyzer';
import { parseRedditJSON, extractTimeSeriesData } from '@/utils/redditParser';
import type { Node, SentimentResult, NodeAnalysis } from '@/types/sentiment';
import type { RedditData, RedditPost } from '@/types/reddit';
import type { AcademicPaper } from '@/types/paper';

// App Flow Steps
type AppStep = 'intro' | 'nodes' | 'source' | 'scraper' | 'loading' | 'results' | 'archive';

const Index = () => {
  // Flow state
  const [currentStep, setCurrentStep] = useState<AppStep>('intro');
  const [previousStep, setPreviousStep] = useState<AppStep | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [selectedSource, setSelectedSource] = useState<SourceType | null>(null);

  // Intro animation state
  const [logoVisible, setLogoVisible] = useState(false);
  const [introFading, setIntroFading] = useState(false);

  // Smooth step transition helper
  const transitionToStep = (nextStep: AppStep) => {
    setIsTransitioning(true);
    setPreviousStep(currentStep);
    setTimeout(() => {
      setCurrentStep(nextStep);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 200);
  };

  // Analysis state
  const [results, setResults] = useState<SentimentResult[]>([]);
  const [nodeAnalysis, setNodeAnalysis] = useState<NodeAnalysis[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
  const [overallSentiment, setOverallSentiment] = useState<number>(0);
  const [sources, setSources] = useState<Array<{ name: string; value: number }>>([]);

  // Loading overlay state
  const [progress, setProgress] = useState(0);
  const [loadingStep, setLoadingStep] = useState(1);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');
  const [scrapedDataCount, setScrapedDataCount] = useState(0);

  const { toast } = useToast();
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

  // Load nodes from localStorage
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  
  useEffect(() => {
    const savedNodes = localStorage.getItem('sentiment-nodes');
    if (savedNodes) {
      try {
        const parsed = JSON.parse(savedNodes);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAllNodes(parsed);
        } else {
          setAllNodes(DEFAULT_NODES);
        }
      } catch {
        setAllNodes(DEFAULT_NODES);
      }
    } else {
      setAllNodes(DEFAULT_NODES);
      localStorage.setItem('sentiment-nodes', JSON.stringify(DEFAULT_NODES));
    }
  }, []);

  // Intro splash screen animation
  useEffect(() => {
    if (currentStep === 'intro') {
      const showLogoTimer = setTimeout(() => setLogoVisible(true), 300);
      const fadeTimer = setTimeout(() => setIntroFading(true), 3200);
      const hideTimer = setTimeout(() => {
        setCurrentStep('nodes');
        setIntroFading(false);
        setLogoVisible(false);
      }, 4700);

      return () => {
        clearTimeout(showLogoTimer);
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [currentStep]);

  // Node selection handler
  const handleNodesContinue = (nodes: Node[]) => {
    setSelectedNodes(nodes);
    transitionToStep('source');
  };

  // Source selection handler
  const handleSourceSelect = (source: SourceType) => {
    setSelectedSource(source);
    transitionToStep('scraper');
  };

  // Combined scrape + analyze handler
  const handleScrapeAndAnalyze = async (data: any[], sourceType: SourceType) => {
    if (data.length === 0) {
      toast({
        title: 'No data found',
        description: 'Try different parameters.',
        variant: 'destructive',
      });
      return;
    }

    setScrapedDataCount(data.length);
    setCurrentStep('loading');
    setProgress(0);
    setLoadingStep(1);
    setAnalysisStatus('Initializing...');

    try {
      let textsToAnalyze: string[] = [];

      // Step 2: Preparing data
      setLoadingStep(2);
      setAnalysisStatus('Preparing data...');
      setProgress(10);

      if (sourceType === 'reddit') {
        const rawData = data as RedditData[];
        const parsed = parseRedditJSON(rawData);
        textsToAnalyze = parsed.allText;
        setSources([{ name: 'Reddit', value: textsToAnalyze.length }]);

        // Extract time series for Reddit
        try {
          const timeSeries = extractTimeSeriesData(rawData, []);
          setTimeSeriesData(timeSeries);
        } catch {
          setTimeSeriesData([]);
        }
      } else {
        // Papers - extract combined text from each paper
        const papers = data as AcademicPaper[];
        textsToAnalyze = papers.map(p => p.combinedText).filter(t => t && t.length > 0);
        setSources([{ name: 'Semantic Scholar', value: textsToAnalyze.length }]);
        setTimeSeriesData([]);
      }

      // Step 3: Sending to AI
      setLoadingStep(3);
      setAnalysisStatus('Sending to AI...');
      setProgress(20);

      // Step 4: Analyzing sentiment (server-side)
      setLoadingStep(4);
      const analysisResults = await performSentimentAnalysisServer(
        textsToAnalyze,
        selectedNodes,
        (p) => setProgress(20 + p * 0.65),
        (status) => setAnalysisStatus(status)
      );

      // Step 5: Aggregating results
      setLoadingStep(5);
      setAnalysisStatus('Aggregating results...');
      setProgress(90);

      const avgSentiment = analysisResults.reduce((sum, r) => sum + r.polarityScore, 0) / analysisResults.length;
      const nodeAnalysisData = aggregateNodeAnalysis(analysisResults);

      // Update time series with results for Reddit
      if (sourceType === 'reddit' && data.length > 0) {
        try {
          const timeSeries = extractTimeSeriesData(data as RedditData[], analysisResults);
          setTimeSeriesData(timeSeries);
        } catch {
          // Keep existing time series
        }
      }

      setProgress(100);
      setResults(analysisResults);
      setOverallSentiment(avgSentiment * 100);
      setNodeAnalysis(nodeAnalysisData);

      toast({
        title: 'Analysis complete',
        description: `Analyzed ${textsToAnalyze.length} texts across ${nodeAnalysisData.length} topics.`,
      });

      // Switch to results
      setCurrentStep('results');
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: 'Analysis failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
      setCurrentStep('scraper');
    } finally {
      setProgress(0);
      setLoadingStep(1);
      setAnalysisStatus('');
    }
  };

  // Navigation handlers
  const handleGoHome = () => {
    transitionToStep('source');
  };

  const handleViewArchive = () => {
    transitionToStep('archive');
  };

  const handleArchiveLoad = (data: any) => {
    // If loading from archive, go back to scraper with data ready
    // For simplicity, we'll re-analyze the data
    if (selectedSource) {
      handleScrapeAndAnalyze(data, selectedSource);
    }
  };

  // Render based on current step
  const renderContent = () => {
    switch (currentStep) {
      case 'intro':
        return (
          <div 
            className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-[1500ms] ease-out ${introFading ? 'opacity-0' : 'opacity-100'}`}
            style={{ backgroundColor: '#030822' }}
          >
            <div className={`transition-opacity duration-[3000ms] ease-in ${logoVisible ? 'opacity-100' : 'opacity-0'}`}>
              <AnimatedLogo />
            </div>
          </div>
        );

      case 'nodes':
        return (
          <div className={`relative z-10 w-full transition-all duration-300 ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
            <NodeSelectionPage nodes={allNodes} onContinue={handleNodesContinue} />
          </div>
        );

      case 'source':
        return (
          <div className={`relative z-10 w-full transition-all duration-300 ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
            <SourceSelector onSelect={handleSourceSelect} onBack={() => transitionToStep('nodes')} />
          </div>
        );

      case 'scraper':
        return (
          <div className={`relative z-10 w-full max-w-3xl mx-auto px-4 transition-all duration-300 ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
            {selectedSource === 'reddit' ? (
              <RedditScraperSimplified
                nodes={selectedNodes}
                onScrapeAndAnalyze={(data) => handleScrapeAndAnalyze(data, 'reddit')}
                onBack={() => transitionToStep('source')}
              />
            ) : (
              <PaperScraperSimplified
                nodes={selectedNodes}
                onScrapeAndAnalyze={(data) => handleScrapeAndAnalyze(data, 'papers')}
                onBack={() => transitionToStep('source')}
              />
            )}
          </div>
        );

      case 'loading':
        return null; // Loading overlay handles this

      case 'results':
        return (
          <ResultsPage
            sourceType={selectedSource || 'reddit'}
            overallSentiment={overallSentiment}
            results={results}
            nodeAnalysis={nodeAnalysis}
            timeSeriesData={timeSeriesData}
            sources={sources}
            onGoHome={handleGoHome}
            onViewArchive={handleViewArchive}
          />
        );

      case 'archive':
        return (
          <ArchivePage
            sourceType={selectedSource || 'reddit'}
            onGoHome={handleGoHome}
            onLoadScrape={handleArchiveLoad}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      {/* Full-screen Particle Background */}
      {currentStep !== 'results' && currentStep !== 'archive' && (
        <>
          <ParticleBackground
            particleCount={60}
            interactive={true}
            dataCount={scrapedDataCount}
          />
          <div className="fixed inset-0 observatory-grid pointer-events-none z-0 opacity-50" />
        </>
      )}

      {/* Analysis Loading Overlay */}
      <AnalysisLoadingOverlay
        isVisible={currentStep === 'loading'}
        progress={progress}
        status={analysisStatus}
        currentStep={loadingStep}
        totalSteps={TOTAL_STEPS}
        totalTexts={scrapedDataCount}
      />

      {/* Main Content */}
      {renderContent()}
    </div>
  );
};

export default Index;
