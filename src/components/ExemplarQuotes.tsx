import { Card } from '@/components/ui/card';
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
  
  const neutral = nodeResults
    .filter(r => r.polarity === 'neutral')
    .sort((a, b) => Math.abs(b.polarityScore) - Math.abs(a.polarityScore))[0];
  
  const negative = nodeResults
    .filter(r => r.polarity === 'negative')
    .sort((a, b) => a.polarityScore - b.polarityScore)[0];

  const quotes = [
    { quote: positive, sentiment: 'positive', label: 'Most Positive' },
    { quote: neutral, sentiment: 'neutral', label: 'Most Neutral' },
    { quote: negative, sentiment: 'negative', label: 'Most Negative' },
  ].filter(q => q.quote);

  if (quotes.length === 0) return null;

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'border-sentiment-positive bg-sentiment-positive/5';
      case 'negative': return 'border-sentiment-negative bg-sentiment-negative/5';
      default: return 'border-muted bg-muted/20';
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Quote className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">{nodeName} - Exemplar Quotes</h3>
      </div>
      <div className="space-y-4">
        {quotes.map(({ quote, sentiment, label }, idx) => (
          <div
            key={idx}
            className={`border-l-4 p-4 rounded-r-lg ${getSentimentColor(sentiment)}`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                {label}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {quote!.polarityScore.toFixed(2)}
              </Badge>
            </div>
            <p className="text-sm text-foreground/80 italic mb-3">
              "{quote!.text.slice(0, 200)}{quote!.text.length > 200 ? '...' : ''}"
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                Trust: {quote!.kpiScores.trust.toFixed(2)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Optimism: {quote!.kpiScores.optimism.toFixed(2)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Clarity: {quote!.kpiScores.clarity.toFixed(2)}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
