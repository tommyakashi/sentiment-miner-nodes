import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Plus, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_KPI_KEYWORDS = {
  trust: ['trust', 'reliable', 'honest', 'transparent', 'credible', 'dependable', 'authentic'],
  optimism: ['hope', 'optimistic', 'positive', 'encouraging', 'promising', 'bright', 'confident'],
  frustration: ['frustration', 'annoying', 'difficult', 'problem', 'issue', 'struggle', 'challenging'],
  clarity: ['clear', 'understand', 'simple', 'obvious', 'transparent', 'straightforward', 'explicit'],
  access: ['access', 'available', 'easy', 'convenient', 'reachable', 'obtainable', 'open'],
  fairness: ['fair', 'equal', 'just', 'equitable', 'balanced', 'impartial', 'unbiased'],
};

interface KPIKeywordsManagerProps {
  onKeywordsChange: (keywords: Record<string, string[]>) => void;
}

export function KPIKeywordsManager({ onKeywordsChange }: KPIKeywordsManagerProps) {
  const [keywords, setKeywords] = useState(DEFAULT_KPI_KEYWORDS);
  const [newKeyword, setNewKeyword] = useState<Record<string, string>>({
    trust: '',
    optimism: '',
    frustration: '',
    clarity: '',
    access: '',
    fairness: '',
  });
  const { toast } = useToast();

  const handleAddKeyword = (kpi: string) => {
    const keyword = newKeyword[kpi]?.trim().toLowerCase();
    if (!keyword) return;

    if (keywords[kpi].includes(keyword)) {
      toast({
        title: 'Duplicate keyword',
        description: 'This keyword already exists for this KPI',
        variant: 'destructive',
      });
      return;
    }

    const updated = {
      ...keywords,
      [kpi]: [...keywords[kpi], keyword],
    };
    setKeywords(updated);
    setNewKeyword({ ...newKeyword, [kpi]: '' });
    onKeywordsChange(updated);
    
    toast({
      title: 'Keyword added',
      description: `Added "${keyword}" to ${kpi}`,
    });
  };

  const handleRemoveKeyword = (kpi: string, keyword: string) => {
    const updated = {
      ...keywords,
      [kpi]: keywords[kpi].filter(k => k !== keyword),
    };
    setKeywords(updated);
    onKeywordsChange(updated);
  };

  const handleReset = () => {
    setKeywords(DEFAULT_KPI_KEYWORDS);
    onKeywordsChange(DEFAULT_KPI_KEYWORDS);
    toast({
      title: 'Keywords reset',
      description: 'All KPI keywords have been reset to defaults',
    });
  };

  const kpiLabels: Record<string, string> = {
    trust: 'Trust',
    optimism: 'Optimism',
    frustration: 'Frustration',
    clarity: 'Clarity',
    access: 'Access',
    fairness: 'Fairness',
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">KPI Keywords</h3>
          <p className="text-sm text-muted-foreground">
            Customize keywords the AI looks for when scoring each KPI
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
      </div>

      <div className="space-y-6">
        {Object.keys(keywords).map((kpi) => (
          <div key={kpi} className="space-y-2">
            <Label className="text-sm font-medium">{kpiLabels[kpi]}</Label>
            
            {/* Existing keywords */}
            <div className="flex flex-wrap gap-2 mb-2">
              {keywords[kpi].map((keyword) => (
                <Badge key={keyword} variant="secondary" className="gap-1">
                  {keyword}
                  <button
                    onClick={() => handleRemoveKeyword(kpi, keyword)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>

            {/* Add new keyword */}
            <div className="flex gap-2">
              <Input
                placeholder={`Add keyword for ${kpiLabels[kpi].toLowerCase()}...`}
                value={newKeyword[kpi]}
                onChange={(e) => setNewKeyword({ ...newKeyword, [kpi]: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddKeyword(kpi);
                  }
                }}
                className="text-sm"
              />
              <Button
                size="sm"
                onClick={() => handleAddKeyword(kpi)}
                disabled={!newKeyword[kpi]?.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
