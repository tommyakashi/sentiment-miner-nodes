import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { SentimentResult } from '@/types/sentiment';

interface ConfidenceDistributionProps {
  results: SentimentResult[];
}

export function ConfidenceDistribution({ results }: ConfidenceDistributionProps) {
  // Create buckets for confidence scores
  const buckets = [
    { range: '0-0.2', min: 0, max: 0.2, count: 0 },
    { range: '0.2-0.4', min: 0.2, max: 0.4, count: 0 },
    { range: '0.4-0.6', min: 0.4, max: 0.6, count: 0 },
    { range: '0.6-0.8', min: 0.6, max: 0.8, count: 0 },
    { range: '0.8-1.0', min: 0.8, max: 1.0, count: 0 },
  ];

  results.forEach((result) => {
    const bucket = buckets.find(b => result.confidence >= b.min && result.confidence < b.max);
    if (bucket) bucket.count++;
  });

  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Confidence Distribution</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Average Confidence: <span className="font-semibold text-foreground">{avgConfidence.toFixed(3)}</span>
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={buckets}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="range" 
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 11 }}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
          />
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
