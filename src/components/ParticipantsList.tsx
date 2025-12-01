import { ScrollArea } from '@/components/ui/scroll-area';
import { Users } from 'lucide-react';

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
  const getScoreColor = (score: number) => {
    if (score > 30) return 'text-sentiment-positive';
    if (score < -30) return 'text-sentiment-negative';
    return 'text-muted-foreground';
  };

  return (
    <div className="relative bg-black/80 backdrop-blur-xl rounded-lg border border-white/10 p-4 font-mono">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{title}</span>
      </div>

      <ScrollArea className="h-[180px]">
        <div className="space-y-2">
          {participants.map((participant, idx) => (
            <div 
              key={idx} 
              className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-xs text-muted-foreground tabular-nums w-4">{idx + 1}</span>
                <span className="text-xs truncate">{participant.username}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground tabular-nums">{participant.count}p</span>
                <span className={`tabular-nums w-10 text-right ${getScoreColor(participant.sentimentScore || 0)}`}>
                  {participant.sentimentScore ? (participant.sentimentScore > 0 ? '+' : '') + participant.sentimentScore.toFixed(0) : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
