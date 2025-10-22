import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip as ChartTooltip,
} from 'recharts';
import type { NodeAnalysis } from '@/types/sentiment';

interface KPIRadarChartProps {
  data: NodeAnalysis[];
}

export function KPIRadarChart({ data }: KPIRadarChartProps) {
  // Memoize radar data preparation
  const radarData = useMemo(() => {
    const kpiNames = ['Trust', 'Optimism', 'Frustration', 'Clarity', 'Access', 'Fairness'];
    
    return kpiNames.map((kpi) => {
      const dataPoint: any = { kpi };
      
      data.slice(0, 5).forEach((node) => {
        const kpiKey = kpi.toLowerCase() as keyof typeof node.avgKpiScores;
        // Normalize to 0-100 scale for better visualization
        dataPoint[node.nodeName] = ((node.avgKpiScores[kpiKey] + 1) / 2) * 100;
      });
      
      return dataPoint;
    });
  }, [data]);

  const colors = useMemo(() => [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ], []);

  return (
    <Card className="p-6">
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
            tickFormatter={(value) => `${value}`}
            label={{ value: '0 = Negative, 50 = Neutral, 100 = Positive', position: 'insideTopLeft', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
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
          <ChartTooltip
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
