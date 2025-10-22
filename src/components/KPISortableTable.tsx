import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { NodeAnalysis } from '@/types/sentiment';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface KPISortableTableProps {
  data: NodeAnalysis[];
}

type SortField = 'name' | 'count' | 'polarity' | 'trust' | 'optimism' | 'frustration' | 'clarity' | 'access' | 'fairness';
type SortDirection = 'asc' | 'desc' | null;

export function KPISortableTable({ data }: KPISortableTableProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : sortDirection === 'desc' ? null : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 opacity-50" />;
    if (sortDirection === 'asc') return <ArrowUp className="w-4 h-4 text-primary" />;
    if (sortDirection === 'desc') return <ArrowDown className="w-4 h-4 text-primary" />;
    return <ArrowUpDown className="w-4 h-4 opacity-50" />;
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortField || !sortDirection) return 0;

    let aVal: number;
    let bVal: number;

    switch (sortField) {
      case 'name':
        return sortDirection === 'asc' 
          ? a.nodeName.localeCompare(b.nodeName)
          : b.nodeName.localeCompare(a.nodeName);
      case 'count':
        aVal = a.totalTexts;
        bVal = b.totalTexts;
        break;
      case 'polarity':
        aVal = a.avgPolarity;
        bVal = b.avgPolarity;
        break;
      case 'trust':
        aVal = a.avgKpiScores.trust;
        bVal = b.avgKpiScores.trust;
        break;
      case 'optimism':
        aVal = a.avgKpiScores.optimism;
        bVal = b.avgKpiScores.optimism;
        break;
      case 'frustration':
        aVal = a.avgKpiScores.frustration;
        bVal = b.avgKpiScores.frustration;
        break;
      case 'clarity':
        aVal = a.avgKpiScores.clarity;
        bVal = b.avgKpiScores.clarity;
        break;
      case 'access':
        aVal = a.avgKpiScores.access;
        bVal = b.avgKpiScores.access;
        break;
      case 'fairness':
        aVal = a.avgKpiScores.fairness;
        bVal = b.avgKpiScores.fairness;
        break;
      default:
        return 0;
    }

    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const getScoreColor = (score: number) => {
    if (score > 0.2) return 'text-sentiment-positive font-semibold';
    if (score < -0.2) return 'text-sentiment-negative font-semibold';
    return 'text-muted-foreground';
  };

  const getScoreBg = (score: number) => {
    if (score > 0.2) return 'bg-sentiment-positive/10';
    if (score < -0.2) return 'bg-sentiment-negative/10';
    return 'bg-muted/30';
  };

  return (
    <Card className="p-6">
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                  Node Name {getSortIcon('name')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort('count')}
              >
                <div className="flex items-center justify-end gap-2">
                  Data Points {getSortIcon('count')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort('polarity')}
              >
                <div className="flex items-center justify-end gap-2">
                  Polarity {getSortIcon('polarity')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort('trust')}
              >
                <div className="flex items-center justify-end gap-2">
                  Trust {getSortIcon('trust')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort('optimism')}
              >
                <div className="flex items-center justify-end gap-2">
                  Optimism {getSortIcon('optimism')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort('frustration')}
              >
                <div className="flex items-center justify-end gap-2">
                  Frustration {getSortIcon('frustration')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort('clarity')}
              >
                <div className="flex items-center justify-end gap-2">
                  Clarity {getSortIcon('clarity')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort('access')}
              >
                <div className="flex items-center justify-end gap-2">
                  Access {getSortIcon('access')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort('fairness')}
              >
                <div className="flex items-center justify-end gap-2">
                  Fairness {getSortIcon('fairness')}
                </div>
              </TableHead>
              <TableHead className="text-right">Distribution</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((node) => (
              <TableRow key={node.nodeId}>
                <TableCell className="font-medium">{node.nodeName}</TableCell>
                <TableCell className="text-right">{node.totalTexts}</TableCell>
                <TableCell className={`text-right ${getScoreColor(node.avgPolarity)}`}>
                  <div className={`inline-block px-2 py-1 rounded ${getScoreBg(node.avgPolarity)}`}>
                    {node.avgPolarity.toFixed(3)}
                  </div>
                </TableCell>
                <TableCell className={`text-right ${getScoreColor(node.avgKpiScores.trust)}`}>
                  {node.avgKpiScores.trust.toFixed(2)}
                </TableCell>
                <TableCell className={`text-right ${getScoreColor(node.avgKpiScores.optimism)}`}>
                  {node.avgKpiScores.optimism.toFixed(2)}
                </TableCell>
                <TableCell className={`text-right ${getScoreColor(node.avgKpiScores.frustration)}`}>
                  {node.avgKpiScores.frustration.toFixed(2)}
                </TableCell>
                <TableCell className={`text-right ${getScoreColor(node.avgKpiScores.clarity)}`}>
                  {node.avgKpiScores.clarity.toFixed(2)}
                </TableCell>
                <TableCell className={`text-right ${getScoreColor(node.avgKpiScores.access)}`}>
                  {node.avgKpiScores.access.toFixed(2)}
                </TableCell>
                <TableCell className={`text-right ${getScoreColor(node.avgKpiScores.fairness)}`}>
                  {node.avgKpiScores.fairness.toFixed(2)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Badge className="bg-sentiment-positive text-white text-xs">
                      +{node.sentimentDistribution.positive}
                    </Badge>
                    <Badge className="bg-muted text-foreground text-xs">
                      ={node.sentimentDistribution.neutral}
                    </Badge>
                    <Badge className="bg-sentiment-negative text-white text-xs">
                      -{node.sentimentDistribution.negative}
                    </Badge>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
