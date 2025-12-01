import { Badge } from '@/components/ui/badge';
import { Quote } from 'lucide-react';
import type { SentimentResult } from '@/types/sentiment';

interface ExemplarQuotesProps {
  results: SentimentResult[];
  nodeId: string;
  nodeName: string;
}

export function ExemplarQuotes({ results, nodeId, nodeName }: ExemplarQuotesProps) {
  const nodeResults = results.filter(r => r.nodeId === nodeId);
  
  const positive = nodeResults
    .filter(r => r.polarity === 'positive')
    .sort((a, b) => b.polarityScore - a.polarityScore)[0];
  
  const negative = nodeResults
    .filter(r => r.polarity === 'negative')
    .sort((a, b) => a.polarityScore - b.polarityScore)[0];

  const quotes = [
    { quote: positive, sentiment: 'positive', label: '+' },
    { quote: negative, sentiment: 'negative', label: '−' },
  ].filter(q => q.quote);

  if (quotes.length === 0) return null;

  const getBorderColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'border-l-sentiment-positive';
      case 'negative': return 'border-l-sentiment-negative';
      default: return 'border-l-white/20';
    }
  };

  return (
    <div className="relative bg-black/80 backdrop-blur-xl rounded-lg border border-white/10 p-4 font-mono">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Quote className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider truncate">{nodeName}</span>
      </div>

      <div className="space-y-3">
        {quotes.map(({ quote, sentiment, label }, idx) => (
          <div
            key={idx}
            className={`border-l-2 pl-3 py-1 ${getBorderColor(sentiment)}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-white/20">
                {label}
              </Badge>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {quote!.polarityScore > 0 ? '+' : ''}{quote!.polarityScore.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              "{quote!.text.slice(0, 120)}{quote!.text.length > 120 ? '...' : ''}"
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
