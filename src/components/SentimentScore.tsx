import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

  const getBgColor = () => {
    if (score > 15) return 'bg-sentiment-positive/10';
    if (score < -15) return 'bg-sentiment-negative/10';
    return 'bg-sentiment-neutral/10';
  };

  const getSentimentLabel = () => {
    if (score > 15) return 'Positive';
    if (score < -15) return 'Negative';
    return 'Neutral';
  };

  const getExplanation = () => {
    if (score > 30) return 'The overall sentiment is positive. Most content expresses favorable opinions, optimism, and satisfaction.';
    if (score < -30) return 'The overall sentiment is negative. Most content expresses concerns, dissatisfaction, or criticism.';
    return 'The overall sentiment is neutral. Content is balanced with mixed positive and negative opinions.';
  };

  return (
    <Card className={`p-6 ${getBgColor()} border-2`}>
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  Scores range from -100 (very negative) to +100 (very positive). 
                  Values between -15 and +15 are considered neutral.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className={`text-6xl font-bold ${getColor()} mb-2`}>
          {score > 0 ? '+' : ''}{Math.round(score)}
        </div>
        <div className="flex items-center justify-center gap-2 mb-3">
          {score > 0 ? (
            <TrendingUp className="w-5 h-5 text-sentiment-positive" />
          ) : (
            <TrendingDown className="w-5 h-5 text-sentiment-negative" />
          )}
          <span className={`text-lg font-semibold ${getColor()}`}>
            {getSentimentLabel()}
          </span>
        </div>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {getExplanation()}
        </p>
      </div>
    </Card>
  );
}
