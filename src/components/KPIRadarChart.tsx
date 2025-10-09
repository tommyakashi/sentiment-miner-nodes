import { Card } from '@/components/ui/card';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import type { NodeAnalysis } from '@/types/sentiment';

interface KPIRadarChartProps {
  data: NodeAnalysis[];
}

export function KPIRadarChart({ data }: KPIRadarChartProps) {
  // Prepare data for radar chart
  const kpiNames = ['Trust', 'Optimism', 'Frustration', 'Clarity', 'Access', 'Fairness'];
  
  const radarData = kpiNames.map((kpi) => {
    const dataPoint: any = { kpi };
    
    data.slice(0, 5).forEach((node) => {
      const kpiKey = kpi.toLowerCase() as keyof typeof node.avgKpiScores;
      // Normalize to 0-100 scale for better visualization
      dataPoint[node.nodeName] = ((node.avgKpiScores[kpiKey] + 1) / 2) * 100;
    });
    
    return dataPoint;
  });

  const colors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">KPI Comparison (Top 5 Nodes)</h3>
      <ResponsiveContainer width="100%" height={400}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis 
            dataKey="kpi" 
            tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
          />
          {data.slice(0, 5).map((node, index) => (
            <Radar
              key={node.nodeId}
              name={node.nodeName}
              dataKey={node.nodeName}
              stroke={colors[index]}
              fill={colors[index]}
              fillOpacity={0.2}
            />
          ))}
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
          />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </Card>
  );
}
