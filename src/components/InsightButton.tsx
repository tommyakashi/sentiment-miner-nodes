import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InsightButtonProps {
  title: string;
  insights: string[];
}

export function InsightButton({ title, insights }: InsightButtonProps) {
  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <Info className="w-4 h-4" />
          {title}
        </Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-96" side="right" align="start">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">{title}</h4>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {insights.map((insight, index) => (
              <li key={index} className="flex gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
