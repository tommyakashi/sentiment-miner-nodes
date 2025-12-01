import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts';

interface SentimentChartProps {
  data: Array<{ date: string; sentiment: number; volume: number }>;
  title: string;
}

export function SentimentChart({ data, title }: SentimentChartProps) {
  const tooltipStyle = useMemo(() => ({
    backgroundColor: 'hsl(0 0% 4%)',
    border: '1px solid hsl(0 0% 20%)',
    borderRadius: '6px',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '11px',
  }), []);

  return (
    <div className="relative bg-black/80 backdrop-blur-xl rounded-lg border border-white/10 p-4 font-mono">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{title}</span>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data}>
          <defs>
            <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--sentiment-positive))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--sentiment-negative))" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" strokeOpacity={0.3} />
          <XAxis 
            dataKey="date" 
            stroke="hsl(0 0% 40%)"
            tick={{ fontSize: 10, fontFamily: 'ui-monospace, monospace' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            yAxisId="left"
            stroke="hsl(0 0% 40%)"
            tick={{ fontSize: 10, fontFamily: 'ui-monospace, monospace' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            stroke="hsl(0 0% 40%)"
            tick={{ fontSize: 10, fontFamily: 'ui-monospace, monospace' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="volume"
            fill="hsl(0 0% 50%)"
            stroke="none"
            fillOpacity={0.15}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="sentiment"
            stroke="hsl(0 0% 100%)"
            strokeWidth={2}
            dot={{ fill: 'hsl(0 0% 100%)', r: 3, strokeWidth: 0 }}
            activeDot={{ fill: 'hsl(0 0% 100%)', r: 5, strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
