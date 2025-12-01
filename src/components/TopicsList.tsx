import { ScrollArea } from '@/components/ui/scroll-area';
import { Hash } from 'lucide-react';
import type { NodeAnalysis } from '@/types/sentiment';

interface TopicsListProps {
  topics: NodeAnalysis[];
}

export function TopicsList({ topics }: TopicsListProps) {
  const getScoreColor = (score: number) => {
    if (score > 0.2) return 'text-sentiment-positive';
    if (score < -0.2) return 'text-sentiment-negative';
    return 'text-muted-foreground';
  };

  const sortedTopics = [...topics].sort((a, b) => b.totalTexts - a.totalTexts);

  return (
    <div className="relative bg-black/80 backdrop-blur-xl rounded-lg border border-white/10 p-4 font-mono">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Hash className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Topics</span>
      </div>

      <ScrollArea className="h-[180px]">
        <div className="space-y-2">
          {sortedTopics.map((topic, idx) => (
            <div 
              key={topic.nodeId} 
              className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-xs text-muted-foreground tabular-nums w-4">{idx + 1}</span>
                <span className="text-xs truncate">{topic.nodeName}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground tabular-nums">{topic.totalTexts}</span>
                <span className={`tabular-nums w-12 text-right ${getScoreColor(topic.avgPolarity)}`}>
                  {topic.avgPolarity > 0 ? '+' : ''}{topic.avgPolarity.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
