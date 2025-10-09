import { Card } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';

interface InsightBoxProps {
  title: string;
  insights: string[];
}

export function InsightBox({ title, insights }: InsightBoxProps) {
  return (
    <Card className="p-4 bg-primary/5 border-primary/20">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
          <Lightbulb className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold mb-2 text-sm">{title}</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {insights.map((insight, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
