import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';

interface TrendingThemesProps {
  themes: Array<{ word: string; frequency: number; sentiment: number }>;
}

export function TrendingThemes({ themes }: TrendingThemesProps) {
  const getSizeClass = (frequency: number) => {
    if (frequency > 20) return 'text-2xl';
    if (frequency > 10) return 'text-xl';
    if (frequency > 5) return 'text-lg';
    return 'text-base';
  };

  const getColor = (sentiment: number) => {
    if (sentiment > 0.3) return 'text-sentiment-positive';
    if (sentiment < -0.3) return 'text-sentiment-negative';
    return 'text-primary';
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5" />
        Trending themes
      </h3>
      <div className="flex flex-wrap gap-2 items-center justify-center min-h-[200px]">
        {themes.map((theme, idx) => (
          <Badge
            key={idx}
            variant="outline"
            className={`${getSizeClass(theme.frequency)} ${getColor(theme.sentiment)} font-semibold border-none hover:scale-110 transition-transform cursor-pointer`}
          >
            {theme.word}
          </Badge>
        ))}
      </div>
    </Card>
  );
}
