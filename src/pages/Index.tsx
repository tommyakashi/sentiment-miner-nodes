import { useState } from 'react';
import { NodeManager } from '@/components/NodeManager';
import { TextInput } from '@/components/TextInput';
import { ResultsTable } from '@/components/ResultsTable';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { analyzeSentiment } from '@/utils/sentimentAnalyzer';
import type { Node, SentimentResult, NodeAnalysis } from '@/types/sentiment';
import { Brain } from 'lucide-react';

const Index = () => {
  const [nodes, setNodes] = useState<Node[]>([
    { id: '1', name: 'Funding Access', keywords: ['funding', 'grant', 'budget', 'financial'] },
    { id: '2', name: 'Research Collaboration', keywords: ['collaboration', 'partnership', 'team', 'joint'] },
    { id: '3', name: 'Open Source Policy', keywords: ['open source', 'licensing', 'public', 'transparency'] },
  ]);
  const [results, setResults] = useState<SentimentResult[]>([]);
  const [nodeAnalysis, setNodeAnalysis] = useState<NodeAnalysis[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleAnalysis = async (texts: string[]) => {
    if (nodes.length === 0) {
      toast({
        title: 'No nodes defined',
        description: 'Please define at least one analysis node before analyzing text.',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);

    try {
      toast({
        title: 'Starting analysis',
        description: 'Loading sentiment model and analyzing text...',
      });

      const analysisResults = await analyzeSentiment(texts, nodes, setProgress);
      setResults(analysisResults);

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

      toast({
        title: 'Analysis complete',
        description: `Successfully analyzed ${texts.length} texts across ${nodeMap.size} nodes.`,
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
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-primary rounded-lg">
              <Brain className="w-8 h-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Multi-Node Sentiment Analyzer
              </h1>
              <p className="text-muted-foreground mt-1">
                Advanced sentiment analysis with KPI scoring and topic clustering
              </p>
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

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <NodeManager nodes={nodes} onNodesChange={setNodes} />
          <TextInput onTextsSubmit={handleAnalysis} disabled={isAnalyzing} />
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ResultsTable results={results} nodeAnalysis={nodeAnalysis} />
        )}
      </div>
    </div>
  );
};

export default Index;
