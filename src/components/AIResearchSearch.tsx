import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Sparkles, Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ResearchPaper } from '@/types/consensus';

interface AISearchResult extends Omit<ResearchPaper, 'selected' | 'uploadedAt'> {
  source: 'lovable-ai' | 'openai' | 'both';
  relevanceScore?: number;
}

interface AIResearchSearchProps {
  onAddToProject: (papers: ResearchPaper[]) => void;
  disabled?: boolean;
}

export const AIResearchSearch = ({ onAddToProject, disabled }: AIResearchSearchProps) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<AISearchResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<any>(null);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({
        title: 'Empty query',
        description: 'Please enter a research topic to search',
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);
    setResults([]);
    setSelectedIds(new Set());

    try {
      toast({
        title: 'Searching...',
        description: 'Querying Lovable AI and OpenAI for research papers',
      });

      // Call both edge functions in parallel
      const [lovableRes, openaiRes] = await Promise.all([
        supabase.functions.invoke('search-consensus-lovable', {
          body: { query: query.trim() },
        }),
        supabase.functions.invoke('search-consensus-openai', {
          body: { query: query.trim() },
        }),
      ]);

      if (lovableRes.error) throw new Error(`Lovable AI search failed: ${lovableRes.error.message}`);
      if (openaiRes.error) throw new Error(`OpenAI search failed: ${openaiRes.error.message}`);

      // Merge and deduplicate
      const mergeRes = await supabase.functions.invoke('merge-research-results', {
        body: {
          setA: lovableRes.data.papers,
          setB: openaiRes.data.papers,
        },
      });

      if (mergeRes.error) throw new Error(`Merge failed: ${mergeRes.error.message}`);

      setResults(mergeRes.data.papers);
      setStats(mergeRes.data.stats);

      toast({
        title: 'Search complete',
        description: `Found ${mergeRes.data.papers.length} unique papers (${mergeRes.data.stats.duplicatesRemoved} duplicates removed)`,
      });
    } catch (error: any) {
      console.error('Search error:', error);
      toast({
        title: 'Search failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map(r => r.id)));
    }
  };

  const handleAddSelected = () => {
    const selectedPapers: ResearchPaper[] = results
      .filter(r => selectedIds.has(r.id))
      .map(r => ({
        ...r,
        selected: false,
        uploadedAt: new Date(),
      }));

    onAddToProject(selectedPapers);
    setSelectedIds(new Set());
    toast({
      title: 'Papers added',
      description: `${selectedPapers.length} papers added to your project`,
    });
  };

  const getSourceBadge = (source: string) => {
    if (source === 'both') {
      return <Badge variant="default">Both AI</Badge>;
    } else if (source === 'lovable-ai') {
      return <Badge variant="secondary">Lovable AI</Badge>;
    } else {
      return <Badge variant="outline">OpenAI</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          AI-Powered Research Search
        </CardTitle>
        <CardDescription>
          Search 200M+ papers using dual AI models (Lovable AI + OpenAI) with automatic deduplication
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="e.g., 'postdoc funding challenges in AI research'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
              disabled={isSearching || disabled}
            />
          </div>
          <Button onClick={handleSearch} disabled={isSearching || disabled}>
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                AI Search
              </>
            )}
          </Button>
        </div>

        {stats && (
          <div className="flex gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">Lovable AI: {stats.lovableAI}</Badge>
            <Badge variant="outline">OpenAI: {stats.openAI}</Badge>
            <Badge variant="default">Both: {stats.foundByBoth}</Badge>
            <Badge>Total: {stats.merged}</Badge>
          </div>
        )}

        {results.length > 0 && (
          <>
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {selectedIds.size === results.length ? 'Deselect All' : 'Select All'}
                </Button>
                {selectedIds.size > 0 && (
                  <Badge variant="secondary">{selectedIds.size} selected</Badge>
                )}
              </div>
              {selectedIds.size > 0 && (
                <Button onClick={handleAddSelected} disabled={disabled}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add {selectedIds.size} to Project
                </Button>
              )}
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {results.map((paper) => (
                <Card key={paper.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedIds.has(paper.id)}
                      onCheckedChange={() => handleToggleSelect(paper.id)}
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm">{paper.title}</h3>
                        {getSourceBadge(paper.source)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {paper.authors.slice(0, 3).join(', ')}
                        {paper.authors.length > 3 && ' et al.'} • {paper.year}
                        {paper.journal && ` • ${paper.journal}`}
                      </p>
                      <p className="text-xs line-clamp-2">{paper.abstract}</p>
                      <div className="flex gap-2">
                        {paper.studyType && (
                          <Badge variant="outline" className="text-xs">
                            {paper.studyType}
                          </Badge>
                        )}
                        {paper.domain && (
                          <Badge variant="outline" className="text-xs">
                            {paper.domain}
                          </Badge>
                        )}
                        {paper.relevanceScore && (
                          <Badge variant="secondary" className="text-xs">
                            Relevance: {Math.round(paper.relevanceScore)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
