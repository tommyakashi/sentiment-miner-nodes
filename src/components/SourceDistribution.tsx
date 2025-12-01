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
      <div className="flex items-center gap-2 mb-3">
        <Database className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Sources</span>
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">{total} total</span>
      </div>

      {/* Source bars */}
      <div className="space-y-3">
        {sources.map((source, idx) => {
          const percentage = total > 0 ? (source.value / total) * 100 : 0;
          return (
            <div key={source.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <span className="text-foreground">{source.name}</span>
                </div>
                <span className="tabular-nums text-muted-foreground">{source.value}</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all"
                  style={{ 
                    width: `${percentage}%`,
                    backgroundColor: COLORS[idx % COLORS.length] 
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
