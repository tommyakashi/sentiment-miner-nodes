import { Radio, BookOpen, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type SourceType = 'reddit' | 'papers';

interface SourceSelectorProps {
  onSelect: (source: SourceType) => void;
  onBack?: () => void;
}

export function SourceSelector({ onSelect, onBack }: SourceSelectorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full max-w-3xl mx-auto px-4 animate-fade-in">
      {/* Back Button */}
      {onBack && (
        <div className="self-start mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="font-mono text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Nodes
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-mono font-bold text-foreground tracking-tight mb-3">
          Choose Data Source
        </h1>
        <p className="text-muted-foreground font-mono text-sm">
          Select where to gather sentiment data
        </p>
      </div>

      {/* Source Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {/* Reddit Card */}
        <button
          onClick={() => onSelect('reddit')}
          className="group relative p-8 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm hover:border-orange-500/30 hover:bg-card/80 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl"
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              <Radio className="w-8 h-8 text-orange-400" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Reddit</h3>
            <p className="text-sm text-muted-foreground font-mono mb-4">
              Research community discussions
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <span className="text-xs font-mono px-2 py-1 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                43 subreddits
              </span>
              <span className="text-xs font-mono px-2 py-1 rounded bg-background/50 text-muted-foreground border border-border/30">
                Real-time
              </span>
            </div>
          </div>
        </button>

        {/* Academic Papers Card */}
        <button
          onClick={() => onSelect('papers')}
          className="group relative p-8 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm hover:border-blue-500/30 hover:bg-card/80 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl"
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300">
              <BookOpen className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Academic Papers</h3>
            <p className="text-sm text-muted-foreground font-mono mb-4">
              Peer-reviewed research sentiment
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <span className="text-xs font-mono px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Semantic Scholar
              </span>
              <span className="text-xs font-mono px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                arXiv
              </span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
