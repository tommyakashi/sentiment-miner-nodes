import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User } from 'lucide-react';

interface Participant {
  username: string;
  count: number;
  totalUpvotes: number;
  sentimentScore?: number;
}

interface ParticipantsListProps {
  participants: Participant[];
  title: string;
}

export function ParticipantsList({ participants, title }: ParticipantsListProps) {
  const getBarWidth = (score: number) => {
    const normalized = ((score + 100) / 200) * 100;
    return `${Math.max(0, Math.min(100, normalized))}%`;
  };

  const getBarColor = (score: number) => {
    if (score > 30) return 'bg-sentiment-positive';
    if (score < -30) return 'bg-sentiment-negative';
    return 'bg-sentiment-neutral';
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <User className="w-5 h-5" />
        {title}
      </h3>
      <ScrollArea className="h-[300px]">
        <div className="space-y-3">
          {participants.map((participant, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-primary">{participant.username}</span>
                <Badge variant="outline" className="text-xs">
                  {participant.count} posts
                </Badge>
              </div>
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${getBarColor(participant.sentimentScore || 0)}`}
                  style={{ width: getBarWidth(participant.sentimentScore || 0) }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Score: {participant.sentimentScore?.toFixed(1) || 'N/A'}</span>
                <span>Upvotes: {participant.totalUpvotes}</span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
