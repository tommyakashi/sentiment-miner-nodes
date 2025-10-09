import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hash } from 'lucide-react';
import type { NodeAnalysis } from '@/types/sentiment';

interface TopicsListProps {
  topics: NodeAnalysis[];
}

export function TopicsList({ topics }: TopicsListProps) {
  const maxTexts = Math.max(...topics.map(t => t.totalTexts), 1);

  const getBarWidth = (count: number) => `${(count / maxTexts) * 100}%`;

  const getBarColor = (avgPolarity: number) => {
    if (avgPolarity > 0.3) return 'bg-sentiment-positive';
    if (avgPolarity < -0.3) return 'bg-sentiment-negative';
    return 'bg-sentiment-neutral';
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Hash className="w-5 h-5" />
        Topics
      </h3>
      <ScrollArea className="h-[300px]">
        <div className="space-y-3">
          {topics.map((topic) => (
            <div key={topic.nodeId} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-primary">{topic.nodeName}</span>
                <span className="text-xs text-muted-foreground">{topic.totalTexts}</span>
              </div>
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${getBarColor(topic.avgPolarity)}`}
                  style={{ width: getBarWidth(topic.totalTexts) }}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Sentiment: {topic.avgPolarity.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
