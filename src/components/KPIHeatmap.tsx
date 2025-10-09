import { Card } from '@/components/ui/card';
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

  const getColor = (value: number) => {
    // Normalize from -1,1 to 0-100
    const normalized = ((value + 1) / 2) * 100;
    
    if (normalized >= 70) return 'bg-sentiment-positive/80 text-white';
    if (normalized >= 55) return 'bg-sentiment-positive/50 text-foreground';
    if (normalized >= 45) return 'bg-muted text-foreground';
    if (normalized >= 30) return 'bg-sentiment-negative/50 text-foreground';
    return 'bg-sentiment-negative/80 text-white';
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">KPI Heatmap</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left p-2 text-sm font-medium border-b">Node</th>
              {kpis.map((kpi) => (
                <th key={kpi.key} className="text-center p-2 text-sm font-medium border-b">
                  {kpi.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((node) => (
              <tr key={node.nodeId}>
                <td className="p-2 text-sm font-medium border-r">{node.nodeName}</td>
                {kpis.map((kpi) => {
                  const value = node.avgKpiScores[kpi.key as keyof typeof node.avgKpiScores];
                  return (
                    <td key={kpi.key} className="p-0">
                      <div
                        className={`p-3 text-center text-sm font-semibold ${getColor(value)}`}
                        title={`${kpi.label}: ${value.toFixed(3)}`}
                      >
                        {value.toFixed(2)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
