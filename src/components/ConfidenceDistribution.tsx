import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Target } from 'lucide-react';
import type { SentimentResult } from '@/types/sentiment';

interface ConfidenceDistributionProps {
  results: SentimentResult[];
}

export function ConfidenceDistribution({ results }: ConfidenceDistributionProps) {
  const chartData = useMemo(() => {
    const buckets = [
      { range: '0-20', min: 0, max: 0.2, count: 0 },
      { range: '20-40', min: 0.2, max: 0.4, count: 0 },
      { range: '40-60', min: 0.4, max: 0.6, count: 0 },
      { range: '60-80', min: 0.6, max: 0.8, count: 0 },
      { range: '80-100', min: 0.8, max: 1.0, count: 0 },
    ];

    results.forEach(r => {
      const bucket = buckets.find(b => r.confidence >= b.min && r.confidence < b.max);
      if (bucket) bucket.count++;
      else if (r.confidence === 1.0) buckets[4].count++;
    });

    return buckets.map(b => ({ range: b.range, count: b.count }));
  }, [results]);

  const avgConfidence = useMemo(() => {
    if (results.length === 0) return 0;
    return results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  }, [results]);

  return (
    <div className="relative bg-black/80 backdrop-blur-xl rounded-lg border border-white/10 p-4 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Confidence</span>
        </div>
        <div className="text-xs">
          <span className="text-muted-foreground">avg: </span>
          <span className="tabular-nums">{(avgConfidence * 100).toFixed(0)}%</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={chartData} barCategoryGap="20%">
          <XAxis 
            dataKey="range" 
            tick={{ fill: 'hsl(0 0% 50%)', fontSize: 9, fontFamily: 'ui-monospace, monospace' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            tick={{ fill: 'hsl(0 0% 50%)', fontSize: 9, fontFamily: 'ui-monospace, monospace' }}
            axisLine={false}
            tickLine={false}
            width={25}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(0 0% 4%)',
              border: '1px solid hsl(0 0% 20%)',
              borderRadius: '6px',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '10px',
            }}
          />
          <Bar 
            dataKey="count" 
            fill="hsl(0 0% 100%)" 
            radius={[2, 2, 0, 0]}
            fillOpacity={0.8}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
