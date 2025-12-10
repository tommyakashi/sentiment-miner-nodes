import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Check, ChevronDown, Layers, Zap } from 'lucide-react';
import type { Node } from '@/types/sentiment';

interface NodeSelectionPageProps {
  nodes: Node[];
  onContinue: (selectedNodes: Node[]) => void;
}

export function NodeSelectionPage({ nodes, onContinue }: NodeSelectionPageProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(nodes.map(n => n.id));

  const toggleNode = (nodeId: string) => {
    setSelectedNodeIds(prev => 
      prev.includes(nodeId) 
        ? prev.filter(id => id !== nodeId)
        : [...prev, nodeId]
    );
  };

  const selectAll = () => {
    setSelectedNodeIds(nodes.map(n => n.id));
  };

  const handleUseAll = () => {
    onContinue(nodes);
  };

  const handleUseSelected = () => {
    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    if (selectedNodes.length > 0) {
      onContinue(selectedNodes);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full max-w-2xl mx-auto px-4 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-mono font-bold text-foreground tracking-tight mb-3">
          Configure Analysis
        </h1>
        <p className="text-muted-foreground font-mono text-sm">
          Select which research dimensions to analyze
        </p>
      </div>

      {/* Options */}
      <div className="w-full space-y-4">
        {/* Use All Nodes - Primary Action */}
        <button
          onClick={handleUseAll}
          className="w-full group relative p-6 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm hover:border-primary/30 hover:bg-card/80 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-foreground">Use All 10 Nodes</h3>
                <p className="text-sm text-muted-foreground font-mono">
                  Comprehensive analysis across all dimensions
                </p>
              </div>
            </div>
            <div className="text-xs font-mono text-muted-foreground bg-background/50 px-3 py-1.5 rounded-lg border border-border/30">
              RECOMMENDED
            </div>
          </div>
        </button>

        {/* Select Specific Nodes - Collapsible */}
        <Collapsible open={showDropdown} onOpenChange={setShowDropdown}>
          <CollapsibleTrigger asChild>
            <button
              className="w-full group relative p-6 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm hover:border-border transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-secondary/50 border border-border/30 flex items-center justify-center">
                    <Layers className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-foreground">Select Specific Nodes</h3>
                    <p className="text-sm text-muted-foreground font-mono">
                      {selectedNodeIds.length}/{nodes.length} nodes selected
                    </p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
              </div>
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-2">
            <div className="p-6 rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm space-y-4">
              {/* Node Grid */}
              <div className="flex flex-wrap gap-2">
                {nodes.map((node) => {
                  const isSelected = selectedNodeIds.includes(node.id);
                  return (
                    <button
                      key={node.id}
                      onClick={() => toggleNode(node.id)}
                      className={`
                        flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                        border
                        ${isSelected
                          ? 'bg-primary/10 border-primary/30 text-foreground'
                          : 'bg-background/30 border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                        }
                      `}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <span>{node.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-border/30">
                <button
                  onClick={selectAll}
                  className="text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
                >
                  Select All
                </button>
                <Button
                  onClick={handleUseSelected}
                  disabled={selectedNodeIds.length === 0}
                  className="gap-2"
                >
                  Continue with {selectedNodeIds.length} Node{selectedNodeIds.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
