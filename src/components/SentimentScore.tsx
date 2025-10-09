import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface SentimentScoreProps {
  score: number;
  label: string;
}

export function SentimentScore({ score, label }: SentimentScoreProps) {
  const getColor = () => {
    if (score > 30) return 'text-sentiment-positive';
    if (score < -30) return 'text-sentiment-negative';
    return 'text-sentiment-neutral';
  };

  const getBgColor = () => {
    if (score > 30) return 'bg-sentiment-positive/10';
    if (score < -30) return 'bg-sentiment-negative/10';
    return 'bg-sentiment-neutral/10';
  };

  return (
    <Card className={`p-6 ${getBgColor()} border-2`}>
      <div className="text-center">
        <div className={`text-6xl font-bold ${getColor()} mb-2`}>
          {Math.abs(Math.round(score))}
        </div>
        <div className="flex items-center justify-center gap-2 text-sm font-medium">
          {score > 0 ? (
            <TrendingUp className="w-4 h-4 text-sentiment-positive" />
          ) : (
            <TrendingDown className="w-4 h-4 text-sentiment-negative" />
          )}
          <span className="text-muted-foreground">{label}</span>
        </div>
      </div>
    </Card>
  );
}
