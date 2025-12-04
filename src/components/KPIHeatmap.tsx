import { Grid3X3 } from 'lucide-react';
import type { NodeAnalysis } from '@/types/sentiment';

interface KPIHeatmapProps {
  data: NodeAnalysis[];
}

export function KPIHeatmap({ data }: KPIHeatmapProps) {
  const kpis = [
    { key: 'trust', label: 'Trust' },
    { key: 'optimism', label: 'Optimism' },
    { key: 'frustration', label: 'Frustration' },
    { key: 'clarity', label: 'Clarity' },
    { key: 'access', label: 'Access' },
    { key: 'fairness', label: 'Fairness' },
  ];

  const getCellColor = (value: number) => {
    if (value > 0.3) return 'bg-sentiment-positive/60 text-white';
    if (value > 0.1) return 'bg-sentiment-positive/30 text-foreground';
    if (value < -0.3) return 'bg-sentiment-negative/60 text-white';
    if (value < -0.1) return 'bg-sentiment-negative/30 text-foreground';
    return 'bg-white/10 text-muted-foreground';
  };

  return (
    <div className="relative bg-black/80 backdrop-blur-xl rounded-lg border border-white/10 p-4 font-mono">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Grid3X3 className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">KPI Heatmap</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="text-left p-1.5 text-muted-foreground font-normal border-b border-white/10">Node</th>
              {kpis.map((kpi) => (
                <th key={kpi.key} className="text-center p-1.5 text-muted-foreground font-normal border-b border-white/10 min-w-[70px]">
                  {kpi.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((node) => (
              <tr key={node.nodeId} className="border-b border-white/5 last:border-0">
                <td className="p-1.5 whitespace-nowrap">{node.nodeName}</td>
                {kpis.map((kpi) => {
                  const value = node.avgKpiScores[kpi.key as keyof typeof node.avgKpiScores];
                  return (
                    <td key={kpi.key} className="p-0.5">
                      <div className={`p-1.5 text-center tabular-nums rounded ${getCellColor(value)}`}>
                        {value > 0 ? '+' : ''}{value.toFixed(1)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
