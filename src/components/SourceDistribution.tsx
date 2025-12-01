import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Database } from 'lucide-react';

interface SourceDistributionProps {
  sources: Array<{ name: string; value: number }>;
}

export function SourceDistribution({ sources }: SourceDistributionProps) {
  const COLORS = [
    'hsl(0, 0%, 100%)',
    'hsl(0, 0%, 70%)',
    'hsl(0, 0%, 50%)',
    'hsl(0, 0%, 35%)',
  ];

  const total = sources.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="relative bg-black/80 backdrop-blur-xl rounded-lg border border-white/10 p-4 font-mono">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Database className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Sources</span>
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">{total} total</span>
      </div>

      <div className="flex items-center gap-4">
        <ResponsiveContainer width={100} height={100}>
          <PieChart>
            <Pie
              data={sources}
              cx="50%"
              cy="50%"
              innerRadius={25}
              outerRadius={45}
              dataKey="value"
              stroke="hsl(0 0% 4%)"
              strokeWidth={2}
            >
              {sources.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(0 0% 4%)',
                border: '1px solid hsl(0 0% 20%)',
                borderRadius: '6px',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '10px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex-1 space-y-2">
          {sources.map((source, idx) => (
            <div key={source.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <span className="text-muted-foreground">{source.name}</span>
              </div>
              <span className="tabular-nums">{source.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
