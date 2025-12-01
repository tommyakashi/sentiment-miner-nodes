import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface SentimentScoreProps {
  score: number;
  label: string;
}

export function SentimentScore({ score, label }: SentimentScoreProps) {
  const getColor = () => {
    if (score > 15) return 'text-sentiment-positive';
    if (score < -15) return 'text-sentiment-negative';
    return 'text-sentiment-neutral';
  };

  const getBorderColor = () => {
    if (score > 15) return 'border-sentiment-positive/30';
    if (score < -15) return 'border-sentiment-negative/30';
    return 'border-white/20';
  };

  const getSentimentLabel = () => {
    if (score > 15) return 'POSITIVE';
    if (score < -15) return 'NEGATIVE';
    return 'NEUTRAL';
  };

  return (
    <div className={`relative bg-black/80 backdrop-blur-xl rounded-lg border ${getBorderColor()} p-4 font-mono`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {score > 0 ? (
            <TrendingUp className="w-3.5 h-3.5 text-sentiment-positive" />
          ) : score < 0 ? (
            <TrendingDown className="w-3.5 h-3.5 text-sentiment-negative" />
          ) : null}
          <span className={`text-xs font-medium ${getColor()}`}>
            {getSentimentLabel()}
          </span>
        </div>
      </div>

      {/* Score Display */}
      <div className="flex items-baseline gap-1">
        <span className={`text-4xl font-bold tabular-nums ${getColor()}`}>
          {score > 0 ? '+' : ''}{Math.round(score)}
        </span>
        <span className="text-sm text-muted-foreground">/100</span>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 ${
            score > 15 ? 'bg-sentiment-positive' : 
            score < -15 ? 'bg-sentiment-negative' : 
            'bg-sentiment-neutral'
          }`}
          style={{ width: `${Math.abs(score)}%` }}
        />
      </div>
    </div>
  );
}
