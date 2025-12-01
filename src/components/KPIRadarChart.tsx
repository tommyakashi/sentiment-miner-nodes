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
      data.slice(0, 3).forEach((node, idx) => {
        const kpiKey = kpi.toLowerCase() as keyof typeof node.avgKpiScores;
        dataPoint[`node${idx}`] = ((node.avgKpiScores[kpiKey] + 1) / 2) * 100;
      });
      return dataPoint;
    });
  }, [data]);

  const colors = useMemo(() => [
    'hsl(0, 0%, 100%)',
    'hsl(0, 0%, 60%)',
    'hsl(0, 0%, 35%)',
  ], []);

  if (data.length === 0) return null;

  return (
    <div className="relative bg-black/80 backdrop-blur-xl rounded-lg border border-white/10 p-4 font-mono">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Radar className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">KPI Radar</span>
      </div>

      {/* Custom Legend - Below header */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
        {data.slice(0, 3).map((node, idx) => (
          <div key={node.nodeId} className="flex items-center gap-1.5">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: colors[idx] }}
            />
            <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
              {node.nodeName}
            </span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="hsl(0 0% 25%)" strokeOpacity={0.5} />
          <PolarAngleAxis 
            dataKey="kpi" 
            tick={{ fill: 'hsl(0 0% 60%)', fontSize: 9, fontFamily: 'ui-monospace, monospace' }}
          />
          <PolarRadiusAxis 
            angle={30} 
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          {data.slice(0, 3).map((node, idx) => (
            <RechartsRadar
              key={node.nodeId}
              name={node.nodeName}
              dataKey={`node${idx}`}
              stroke={colors[idx]}
              fill={colors[idx]}
              fillOpacity={0.15}
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
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
