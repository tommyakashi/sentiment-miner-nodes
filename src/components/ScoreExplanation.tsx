import { Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

interface ScoreExplanationProps {
  score: number; // -100 to +100
}

const SCORE_RANGES = [
  {
    min: 50,
    max: 100,
    label: 'Strongly Positive',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    icon: TrendingUp,
    description: 'High enthusiasm and optimism. The community sentiment is strongly favorable, indicating widespread support and positive outlook.',
    implication: 'This suggests strong alignment with researcher needs and expectations. Consider this a green light for current direction.',
  },
  {
    min: 20,
    max: 49.99,
    label: 'Moderately Positive',
    color: 'text-emerald-300',
    bgColor: 'bg-emerald-500/5',
    borderColor: 'border-emerald-500/20',
    icon: TrendingUp,
    description: 'Generally favorable sentiment with some reservations. More positive signals than negative.',
    implication: 'Good foundation but room for improvement. Address minor concerns while maintaining current strengths.',
  },
  {
    min: -19.99,
    max: 19.99,
    label: 'Neutral',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/10',
    borderColor: 'border-border/50',
    icon: Minus,
    description: 'Mixed or balanced sentiment. Neither strongly positive nor negative. May indicate ambivalence or divided opinions.',
    implication: 'Opportunity to shape perception. Focus on clear communication and addressing uncertainties.',
  },
  {
    min: -49.99,
    max: -20,
    label: 'Moderately Negative',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    icon: TrendingDown,
    description: 'Noticeable frustration or concern. More critical signals than positive ones.',
    implication: 'Warning signal. Investigate specific pain points and prioritize addressing key concerns.',
  },
  {
    min: -100,
    max: -50,
    label: 'Strongly Negative',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    icon: TrendingDown,
    description: 'Significant dissatisfaction or criticism. Widespread concern or frustration detected.',
    implication: 'Critical attention needed. This indicates systemic issues requiring immediate investigation and action.',
  },
];

export function ScoreExplanation({ score }: ScoreExplanationProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getScoreRange = (value: number) => {
    return SCORE_RANGES.find(range => value >= range.min && value <= range.max) || SCORE_RANGES[2];
  };

  const currentRange = getScoreRange(score);
  const Icon = currentRange.icon;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className={`w-full flex items-center justify-between p-4 rounded-lg border ${currentRange.borderColor} ${currentRange.bgColor} transition-all hover:opacity-90`}>
          <div className="flex items-center gap-3">
            <Icon className={`w-5 h-5 ${currentRange.color}`} />
            <div className="text-left">
              <div className={`text-sm font-semibold ${currentRange.color}`}>
                {currentRange.label}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                Score: {score >= 0 ? '+' : ''}{score.toFixed(1)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">What does this mean?</span>
            <Info className="w-4 h-4 text-muted-foreground" />
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 p-5 rounded-lg border border-border/50 bg-card/40 space-y-4">
          {/* Score Scale */}
          <div className="space-y-2">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Score Scale</div>
            <div className="relative h-3 bg-gradient-to-r from-red-500 via-muted via-50% to-emerald-500 rounded-full">
              <div 
                className="absolute top-0 w-4 h-4 -mt-0.5 bg-foreground rounded-full border-2 border-background shadow-lg"
                style={{ left: `${((score + 100) / 200) * 100}%`, transform: 'translateX(-50%)' }}
              />
            </div>
            <div className="flex justify-between text-xs font-mono text-muted-foreground">
              <span>-100</span>
              <span>0</span>
              <span>+100</span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">What It Means</div>
            <p className="text-sm text-foreground leading-relaxed">
              {currentRange.description}
            </p>
          </div>

          {/* Implication */}
          <div className="space-y-2">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">So What?</div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {currentRange.implication}
            </p>
          </div>

          {/* All Ranges Reference */}
          <div className="pt-4 border-t border-border/30 space-y-2">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Quick Reference</div>
            <div className="grid grid-cols-5 gap-2">
              {SCORE_RANGES.map((range) => (
                <div 
                  key={range.label}
                  className={`p-2 rounded text-center ${range.bgColor} border ${range.borderColor} ${score >= range.min && score <= range.max ? 'ring-2 ring-foreground/30' : 'opacity-50'}`}
                >
                  <div className={`text-xs font-semibold ${range.color}`}>
                    {range.min >= 0 ? '+' : ''}{range.min}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {range.label.split(' ')[0]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
