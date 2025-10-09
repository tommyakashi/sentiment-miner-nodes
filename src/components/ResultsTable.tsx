import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { SentimentResult, NodeAnalysis } from '@/types/sentiment';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ResultsTableProps {
  results: SentimentResult[];
  nodeAnalysis: NodeAnalysis[];
}

export function ResultsTable({ results, nodeAnalysis }: ResultsTableProps) {
  const getSentimentColor = (polarity: string) => {
    switch (polarity) {
      case 'positive':
        return 'bg-sentiment-positive text-white';
      case 'negative':
        return 'bg-sentiment-negative text-white';
      default:
        return 'bg-sentiment-neutral text-foreground';
    }
  };

  const getScoreColor = (score: number) => {
    if (score > 0.3) return 'text-sentiment-positive';
    if (score < -0.3) return 'text-sentiment-negative';
    return 'text-sentiment-neutral';
  };

  const exportToJSON = () => {
    const dataStr = JSON.stringify({ results, nodeAnalysis }, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sentiment-analysis-${Date.now()}.json`;
    link.click();
  };

  const exportToCSV = () => {
    const headers = ['Text', 'Node', 'Polarity', 'Score', 'Trust', 'Optimism', 'Frustration', 'Clarity', 'Access', 'Fairness', 'Confidence'];
    const rows = results.map(r => [
      `"${r.text.replace(/"/g, '""')}"`,
      r.nodeName,
      r.polarity,
      r.polarityScore.toFixed(3),
      r.kpiScores.trust.toFixed(3),
      r.kpiScores.optimism.toFixed(3),
      r.kpiScores.frustration.toFixed(3),
      r.kpiScores.clarity.toFixed(3),
      r.kpiScores.access.toFixed(3),
      r.kpiScores.fairness.toFixed(3),
      r.confidence.toFixed(3),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sentiment-analysis-${Date.now()}.csv`;
    link.click();
  };

  if (results.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Node Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {nodeAnalysis.map((node) => (
          <Card key={node.nodeId} className="p-4">
            <h3 className="font-semibold mb-2">{node.nodeName}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Texts:</span>
                <span className="font-medium">{node.totalTexts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Score:</span>
                <span className={`font-medium ${getScoreColor(node.avgPolarity)}`}>
                  {node.avgPolarity.toFixed(2)}
                </span>
              </div>
              <div className="flex gap-2 pt-2">
                <Badge className="bg-sentiment-positive text-white text-xs">
                  +{node.sentimentDistribution.positive}
                </Badge>
                <Badge className="bg-sentiment-neutral text-foreground text-xs">
                  ={node.sentimentDistribution.neutral}
                </Badge>
                <Badge className="bg-sentiment-negative text-white text-xs">
                  -{node.sentimentDistribution.negative}
                </Badge>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Results Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Analysis Results</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportToJSON}>
              <Download className="w-4 h-4 mr-2" />
              JSON
            </Button>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Text</TableHead>
                <TableHead>Node</TableHead>
                <TableHead>Sentiment</TableHead>
                <TableHead className="text-right">Trust</TableHead>
                <TableHead className="text-right">Optimism</TableHead>
                <TableHead className="text-right">Frustration</TableHead>
                <TableHead className="text-right">Clarity</TableHead>
                <TableHead className="text-right">Access</TableHead>
                <TableHead className="text-right">Fairness</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-mono text-xs">
                    {result.text.slice(0, 100)}
                    {result.text.length > 100 && '...'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{result.nodeName}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getSentimentColor(result.polarity)}>
                      {result.polarity}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right font-medium ${getScoreColor(result.kpiScores.trust)}`}>
                    {result.kpiScores.trust.toFixed(2)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${getScoreColor(result.kpiScores.optimism)}`}>
                    {result.kpiScores.optimism.toFixed(2)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${getScoreColor(result.kpiScores.frustration)}`}>
                    {result.kpiScores.frustration.toFixed(2)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${getScoreColor(result.kpiScores.clarity)}`}>
                    {result.kpiScores.clarity.toFixed(2)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${getScoreColor(result.kpiScores.access)}`}>
                    {result.kpiScores.access.toFixed(2)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${getScoreColor(result.kpiScores.fairness)}`}>
                    {result.kpiScores.fairness.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
