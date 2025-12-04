import { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { NodeAnalysis } from '@/types/sentiment';

type SortField = 'nodeName' | 'totalTexts' | 'avgPolarity' | 'trust' | 'optimism' | 'frustration' | 'clarity' | 'access' | 'fairness';

interface KPISortableTableProps {
  data: NodeAnalysis[];
}

export function KPISortableTable({ data }: KPISortableTableProps) {
  const [sortField, setSortField] = useState<SortField>('avgPolarity');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3" /> 
      : <ArrowDown className="w-3 h-3" />;
  };

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      let aVal: number, bVal: number;
      
      switch (sortField) {
        case 'nodeName':
          return sortDirection === 'asc' 
            ? a.nodeName.localeCompare(b.nodeName)
            : b.nodeName.localeCompare(a.nodeName);
        case 'totalTexts':
          aVal = a.totalTexts;
          bVal = b.totalTexts;
          break;
        case 'avgPolarity':
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
  }, [data, sortField, sortDirection]);

  const getScoreColor = (score: number) => {
    if (score > 0.2) return 'text-sentiment-positive';
    if (score < -0.2) return 'text-sentiment-negative';
    return 'text-muted-foreground';
  };

  const getScoreBg = (score: number) => {
    if (score > 0.2) return 'bg-sentiment-positive/20';
    if (score < -0.2) return 'bg-sentiment-negative/20';
    return 'bg-white/5';
  };

  return (
    <div className="relative bg-black/80 backdrop-blur-xl rounded-lg border border-blue-500/20 overflow-hidden font-mono">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-blue-500/20 bg-blue-500/5">
        <BarChart3 className="w-4 h-4 text-blue-400" />
        <span className="text-xs text-blue-400 uppercase tracking-wider">KPI Analysis</span>
        <span className="text-xs text-muted-foreground ml-auto">{data.length} nodes</span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead 
                className="cursor-pointer hover:text-foreground text-xs"
                onClick={() => handleSort('nodeName')}
              >
                <div className="flex items-center gap-1">
                  Node {getSortIcon('nodeName')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground text-right text-xs"
                onClick={() => handleSort('totalTexts')}
              >
                <div className="flex items-center justify-end gap-1">
                  Count {getSortIcon('totalTexts')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground text-right text-xs"
                onClick={() => handleSort('avgPolarity')}
              >
                <div className="flex items-center justify-end gap-1">
                  Polarity {getSortIcon('avgPolarity')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground text-right text-xs"
                onClick={() => handleSort('trust')}
              >
                <div className="flex items-center justify-end gap-1">
                  Trust {getSortIcon('trust')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground text-right text-xs"
                onClick={() => handleSort('optimism')}
              >
                <div className="flex items-center justify-end gap-1">
                  Optimism {getSortIcon('optimism')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground text-right text-xs"
                onClick={() => handleSort('frustration')}
              >
                <div className="flex items-center justify-end gap-1">
                  Frustration {getSortIcon('frustration')}
                </div>
              </TableHead>
              <TableHead className="text-xs">Distribution</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((node) => (
              <TableRow key={node.nodeId} className="border-white/5 hover:bg-white/5">
                <TableCell className="text-xs font-medium max-w-[150px] truncate">
                  {node.nodeName}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                  {node.totalTexts}
                </TableCell>
                <TableCell className="text-right">
                  <span className={`text-xs tabular-nums px-1.5 py-0.5 rounded ${getScoreBg(node.avgPolarity)} ${getScoreColor(node.avgPolarity)}`}>
                    {node.avgPolarity > 0 ? '+' : ''}{node.avgPolarity.toFixed(2)}
                  </span>
                </TableCell>
                <TableCell className={`text-right text-xs tabular-nums ${getScoreColor(node.avgKpiScores.trust)}`}>
                  {node.avgKpiScores.trust.toFixed(2)}
                </TableCell>
                <TableCell className={`text-right text-xs tabular-nums ${getScoreColor(node.avgKpiScores.optimism)}`}>
                  {node.avgKpiScores.optimism.toFixed(2)}
                </TableCell>
                <TableCell className={`text-right text-xs tabular-nums ${getScoreColor(node.avgKpiScores.frustration)}`}>
                  {node.avgKpiScores.frustration.toFixed(2)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-sentiment-positive/20 border-sentiment-positive/30 text-sentiment-positive">
                      {node.sentimentDistribution.positive}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-white/10 border-white/20 text-muted-foreground">
                      {node.sentimentDistribution.neutral}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-sentiment-negative/20 border-sentiment-negative/30 text-sentiment-negative">
                      {node.sentimentDistribution.negative}
                    </Badge>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
