import { useMemo } from 'react';
import { Radar } from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar as RechartsRadar,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import type { NodeAnalysis } from '@/types/sentiment';

interface KPIRadarChartProps {
  data: NodeAnalysis[];
}

export function KPIRadarChart({ data }: KPIRadarChartProps) {
  const chartData = useMemo(() => {
    const kpiNames = ['Trust', 'Optimism', 'Frustration', 'Clarity', 'Access', 'Fairness'];
    
    return kpiNames.map(kpi => {
      const dataPoint: any = { kpi };
      data.slice(0, 4).forEach((node, idx) => {
        const kpiKey = kpi.toLowerCase() as keyof typeof node.avgKpiScores;
        dataPoint[`node${idx}`] = ((node.avgKpiScores[kpiKey] + 1) / 2) * 100;
      });
      return dataPoint;
    });
  }, [data]);

  const colors = useMemo(() => [
    'hsl(0, 0%, 100%)',
    'hsl(0, 0%, 70%)',
    'hsl(0, 0%, 50%)',
    'hsl(0, 0%, 35%)',
  ], []);

  if (data.length === 0) return null;

  return (
    <div className="relative bg-black/80 backdrop-blur-xl rounded-lg border border-white/10 p-4 font-mono">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Radar className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">KPI Radar</span>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={chartData}>
          <PolarGrid stroke="hsl(0 0% 25%)" strokeOpacity={0.5} />
          <PolarAngleAxis 
            dataKey="kpi" 
            tick={{ fill: 'hsl(0 0% 60%)', fontSize: 10, fontFamily: 'ui-monospace, monospace' }}
          />
          <PolarRadiusAxis 
            angle={30} 
            domain={[0, 100]}
            tick={{ fill: 'hsl(0 0% 40%)', fontSize: 8, fontFamily: 'ui-monospace, monospace' }}
            tickCount={4}
          />
          {data.slice(0, 4).map((node, idx) => (
            <RechartsRadar
              key={node.nodeId}
              name={node.nodeName.length > 15 ? node.nodeName.slice(0, 15) + '...' : node.nodeName}
              dataKey={`node${idx}`}
              stroke={colors[idx]}
              fill={colors[idx]}
              fillOpacity={0.1}
              strokeWidth={1.5}
            />
          ))}
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(0 0% 4%)',
              border: '1px solid hsl(0 0% 20%)',
              borderRadius: '6px',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '10px',
            }}
          />
          <Legend 
            wrapperStyle={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
