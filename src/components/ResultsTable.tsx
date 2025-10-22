import { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import type { SentimentResult, NodeAnalysis, Node } from '@/types/sentiment';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ResultsTableProps {
  results: SentimentResult[];
  nodeAnalysis: NodeAnalysis[];
  nodes: Node[];
  overallSentiment: number;
  totalTexts: number;
  sources?: Array<{ name: string; value: number }>;
}

export function ResultsTable({ 
  results, 
  nodeAnalysis, 
  nodes, 
  overallSentiment, 
  totalTexts,
  sources = [] 
}: ResultsTableProps) {
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

  const exportSummaryCSV = () => {
    const headers = ['Node', 'Total Texts', 'Avg Sentiment', 'Positive', 'Neutral', 'Negative', 'Trust', 'Optimism', 'Frustration', 'Clarity', 'Access', 'Fairness'];
    const rows = nodeAnalysis.map(node => [
      node.nodeName,
      node.totalTexts,
      node.avgPolarity.toFixed(2),
      node.sentimentDistribution.positive,
      node.sentimentDistribution.neutral,
      node.sentimentDistribution.negative,
      node.avgKpiScores.trust.toFixed(2),
      node.avgKpiScores.optimism.toFixed(2),
      node.avgKpiScores.frustration.toFixed(2),
      node.avgKpiScores.clarity.toFixed(2),
      node.avgKpiScores.access.toFixed(2),
      node.avgKpiScores.fairness.toFixed(2),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sentiment-summary-${Date.now()}.csv`;
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

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 20;

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Sentiment Analysis Report', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Analysis Summary
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Analysis Summary', 14, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Texts Analyzed: ${totalTexts}`, 14, yPosition);
    yPosition += 6;
    doc.text(`Number of Nodes: ${nodes.length}`, 14, yPosition);
    yPosition += 6;
    doc.text(`Overall Sentiment Score: ${overallSentiment.toFixed(2)}`, 14, yPosition);
    yPosition += 6;
    
    if (sources.length > 0) {
      doc.text(`Data Sources: ${sources.map(s => `${s.name} (${s.value})`).join(', ')}`, 14, yPosition);
      yPosition += 10;
    } else {
      yPosition += 4;
    }

    // Node Configurations
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Node Configurations', 14, yPosition);
    yPosition += 8;

    nodes.forEach((node, idx) => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${idx + 1}. ${node.name}`, 14, yPosition);
      yPosition += 6;
      
      doc.setFont('helvetica', 'normal');
      const keywords = `Keywords: ${node.keywords.join(', ')}`;
      const splitKeywords = doc.splitTextToSize(keywords, pageWidth - 28);
      doc.text(splitKeywords, 20, yPosition);
      yPosition += (splitKeywords.length * 5) + 4;

      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
    });

    yPosition += 5;

    // Node Analysis Summary Table
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Node Analysis Summary', 14, yPosition);
    yPosition += 8;

    autoTable(doc, {
      startY: yPosition,
      head: [['Node', 'Texts', 'Avg Score', 'Positive', 'Neutral', 'Negative']],
      body: nodeAnalysis.map(node => [
        node.nodeName,
        node.totalTexts.toString(),
        node.avgPolarity.toFixed(2),
        node.sentimentDistribution.positive.toString(),
        node.sentimentDistribution.neutral.toString(),
        node.sentimentDistribution.negative.toString(),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 9 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    // KPI Scores Table
    if (yPosition > 220) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('KPI Scores by Node', 14, yPosition);
    yPosition += 8;

    autoTable(doc, {
      startY: yPosition,
      head: [['Node', 'Trust', 'Optimism', 'Frustration', 'Clarity', 'Access', 'Fairness']],
      body: nodeAnalysis.map(node => [
        node.nodeName,
        node.avgKpiScores.trust.toFixed(2),
        node.avgKpiScores.optimism.toFixed(2),
        node.avgKpiScores.frustration.toFixed(2),
        node.avgKpiScores.clarity.toFixed(2),
        node.avgKpiScores.access.toFixed(2),
        node.avgKpiScores.fairness.toFixed(2),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 8 },
    });

    // Save the PDF
    doc.save(`sentiment-analysis-report-${Date.now()}.pdf`);
  };

  // Virtual scrolling component
  const VirtualizedTable = ({ 
    results, 
    getSentimentColor, 
    getScoreColor 
  }: { 
    results: SentimentResult[]; 
    getSentimentColor: (polarity: string) => string;
    getScoreColor: (score: number) => string;
  }) => {
    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
      count: results.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 60,
      overscan: 10,
    });

    return (
      <div 
        ref={parentRef} 
        className="border rounded-lg overflow-auto" 
        style={{ height: '600px' }}
      >
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
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
          <TableBody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const result = results[virtualRow.index];
              return (
                <TableRow 
                  key={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
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
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
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
            <Button onClick={exportSummaryCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export Summary
            </Button>
            <Button variant="outline" size="sm" onClick={exportToPDF}>
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Full CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportToJSON}>
              <Download className="w-4 h-4 mr-2" />
              JSON
            </Button>
          </div>
        </div>

        <VirtualizedTable 
          results={results}
          getSentimentColor={getSentimentColor}
          getScoreColor={getScoreColor}
        />
      </Card>
    </div>
  );
}
