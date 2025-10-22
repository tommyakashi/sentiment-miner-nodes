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

  const getGradientColor = (value: number) => {
    // Normalize from -1,1 to 0-1 range
    const normalized = (value + 1) / 2;
    
    // Create smooth gradient from red (0) -> yellow (0.5) -> green (1)
    let r: number, g: number, b: number;
    
    if (normalized < 0.5) {
      // Red to Yellow: red stays high, green increases
      const t = normalized * 2; // 0 to 1
      r = 220; // Deep red
      g = Math.round(50 + (200 * t)); // 50 to 250
      b = 50;
    } else {
      // Yellow to Green: red decreases, green stays high
      const t = (normalized - 0.5) * 2; // 0 to 1
      r = Math.round(220 - (180 * t)); // 220 to 40
      g = 200 + Math.round(20 * t); // 200 to 220
      b = 50 + Math.round(30 * t); // 50 to 80
    }
    
    // Determine text color based on brightness
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const textColor = brightness > 140 ? 'rgb(30, 30, 30)' : 'rgb(255, 255, 255)';
    
    return {
      backgroundColor: `rgb(${r}, ${g}, ${b})`,
      color: textColor,
    };
  };

  const getIntensityLabel = (value: number) => {
    const normalized = (value + 1) / 2;
    if (normalized >= 0.7) return 'Very Strong';
    if (normalized >= 0.55) return 'Strong';
    if (normalized >= 0.45) return 'Moderate';
    if (normalized >= 0.3) return 'Weak';
    return 'Very Weak';
  };

  return (
    <Card className="p-6">
      <div className="mb-4 p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">Score Range:</span>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Very Weak</span>
            <div className="w-32 h-3 rounded-full" style={{
              background: 'linear-gradient(to right, rgb(220, 50, 50), rgb(220, 200, 50), rgb(40, 220, 80))'
            }}></div>
            <span className="text-muted-foreground">Very Strong</span>
          </div>
        </div>
      </div>
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
                  const colorStyle = getGradientColor(value);
                  return (
                    <td key={kpi.key} className="p-0">
                      <div
                        className="p-3 text-center text-sm font-semibold transition-all hover:scale-105"
                        style={colorStyle}
                        title={`${kpi.label}: ${value.toFixed(3)} (${getIntensityLabel(value)})`}
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
