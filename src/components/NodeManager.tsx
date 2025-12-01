import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, Sparkles, Upload, Save, FolderOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Node } from '@/types/sentiment';

interface NodeManagerProps {
  nodes: Node[];
  onNodesChange: (nodes: Node[]) => void;
}

export function NodeManager({ nodes, onNodesChange }: NodeManagerProps) {
  const [newNodeName, setNewNodeName] = useState('');
  const [bulkNodeText, setBulkNodeText] = useState('');
  const [newKeyword, setNewKeyword] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState({ current: 0, total: 0, nodeName: '' });
  const { toast } = useToast();

  const DEFAULT_NODES: Node[] = [
    { id: '1', name: 'Funding Outlook & Sustainability', keywords: [] },
    { id: '2', name: 'Open Science & Transparency', keywords: [] },
    { id: '3', name: 'Collaboration & Community', keywords: [] },
    { id: '4', name: 'Institutional Trust', keywords: [] },
    { id: '5', name: 'Administrative Load', keywords: [] },
    { id: '6', name: 'Technological Enablement', keywords: [] },
    { id: '7', name: 'Future of AI & U.S. vs China Race', keywords: [] },
    { id: '8', name: 'Ethical Responsibility', keywords: [] },
    { id: '9', name: 'Career Outlook & Researcher Well-being', keywords: [] },
    { id: '10', name: 'Impact & Recognition', keywords: [] },
  ];

  // Load nodes from localStorage on mount - only if nodes array is empty
  useEffect(() => {
    // Skip if nodes are already loaded (from Index.tsx)
    if (nodes.length > 0) return;
    
    const savedNodes = localStorage.getItem('sentiment-nodes');
    if (savedNodes) {
      try {
        const parsed = JSON.parse(savedNodes);
        if (Array.isArray(parsed) && parsed.length > 0) {
          onNodesChange(parsed);
        } else {
          onNodesChange(DEFAULT_NODES);
          localStorage.setItem('sentiment-nodes', JSON.stringify(DEFAULT_NODES));
        }
      } catch (error) {
        console.error('Error loading saved nodes:', error);
        onNodesChange(DEFAULT_NODES);
        localStorage.setItem('sentiment-nodes', JSON.stringify(DEFAULT_NODES));
      }
    } else {
      onNodesChange(DEFAULT_NODES);
      localStorage.setItem('sentiment-nodes', JSON.stringify(DEFAULT_NODES));
    }
  }, []); // Empty dependency array - only run on mount

  // Save nodes to localStorage whenever they change
  useEffect(() => {
    if (nodes.length > 0) {
      localStorage.setItem('sentiment-nodes', JSON.stringify(nodes));
    }
  }, [nodes]);

  const saveNodes = () => {
    localStorage.setItem('sentiment-nodes', JSON.stringify(nodes));
    toast({
      title: "Nodes saved",
      description: `Saved ${nodes.length} nodes to browser storage`,
    });
  };

  const loadNodes = () => {
    const savedNodes = localStorage.getItem('sentiment-nodes');
    if (savedNodes) {
      try {
        const parsed = JSON.parse(savedNodes);
        onNodesChange(parsed);
        toast({
          title: "Nodes loaded",
          description: `Loaded ${parsed.length} saved nodes`,
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load saved nodes",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "No saved nodes",
        description: "No nodes found in browser storage",
        variant: "destructive",
      });
    }
  };

  const clearSavedNodes = () => {
    localStorage.removeItem('sentiment-nodes');
    onNodesChange([]);
    toast({
      title: "Nodes cleared",
      description: "Cleared all nodes and saved data",
    });
  };

  const addNode = () => {
    if (!newNodeName.trim() || nodes.length >= 10) return;
    
    const newNode: Node = {
      id: `node-${Date.now()}`,
      name: newNodeName.trim(),
      keywords: [],
    };
    
    onNodesChange([...nodes, newNode]);
    setNewNodeName('');
  };

  const addBulkNodes = () => {
    if (!bulkNodeText.trim()) return;
    
    // Split by newlines and filter out empty strings
    const nodeNames = bulkNodeText
      .split(/\r?\n/)
      .map(name => name.trim())
      .filter(name => name.length > 0);
    
    const remainingSlots = 10 - nodes.length;
    const nodesToAdd = nodeNames.slice(0, remainingSlots);
    
    if (nodesToAdd.length === 0) {
      toast({
        title: "No nodes to add",
        description: "Either all slots are full or no valid node names found.",
        variant: "destructive",
      });
      return;
    }
    
    const newNodes: Node[] = nodesToAdd.map((name, index) => ({
      id: `node-${Date.now()}-${index}`,
      name: name,
      keywords: [],
    }));
    
    onNodesChange([...nodes, ...newNodes]);
    setBulkNodeText('');
    
    toast({
      title: "Nodes added",
      description: `Added ${newNodes.length} node${newNodes.length > 1 ? 's' : ''} successfully.`,
    });
  };

  const generateKeywords = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-keywords', {
        body: { 
          nodeName: node.name,
          existingKeywords: node.keywords 
        }
      });

      if (error) throw error;

      if (data?.keywords && Array.isArray(data.keywords)) {
        onNodesChange(nodes.map(n => 
          n.id === nodeId 
            ? { ...n, keywords: [...n.keywords, ...data.keywords] }
            : n
        ));
        
        toast({
          title: "Keywords generated",
          description: `Added ${data.keywords.length} keywords to ${node.name}`,
        });
      }
    } catch (error: any) {
      console.error('Error generating keywords:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate keywords",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAllKeywords = async () => {
    if (nodes.length === 0) return;

    setIsGenerating(true);
    setGeneratingProgress({ current: 0, total: nodes.length, nodeName: '' });
    let successCount = 0;
    const updatedNodes = [...nodes];

    for (let i = 0; i < updatedNodes.length; i++) {
      const node = updatedNodes[i];
      setGeneratingProgress({ current: i + 1, total: nodes.length, nodeName: node.name });
      
      try {
        const { data, error } = await supabase.functions.invoke('generate-keywords', {
          body: { 
            nodeName: node.name,
            existingKeywords: node.keywords 
          }
        });

        if (error) throw error;

        if (data?.keywords && Array.isArray(data.keywords)) {
          updatedNodes[i] = {
            ...node,
            keywords: [...node.keywords, ...data.keywords]
          };
          successCount++;
        }
      } catch (error: any) {
        console.error(`Error generating keywords for ${node.name}:`, error);
      }
    }

    onNodesChange(updatedNodes);
    setIsGenerating(false);
    setGeneratingProgress({ current: 0, total: 0, nodeName: '' });
    
    toast({
      title: "Batch generation complete",
      description: `Generated keywords for ${successCount} out of ${nodes.length} nodes`,
    });
  };

  const removeNode = (id: string) => {
    onNodesChange(nodes.filter(node => node.id !== id));
  };

  const addKeyword = (nodeId: string) => {
    const keyword = newKeyword[nodeId]?.trim();
    if (!keyword) return;

    onNodesChange(nodes.map(node => 
      node.id === nodeId 
        ? { ...node, keywords: [...node.keywords, keyword] }
        : node
    ));
    
    setNewKeyword({ ...newKeyword, [nodeId]: '' });
  };

  const removeKeyword = (nodeId: string, keyword: string) => {
    onNodesChange(nodes.map(node =>
      node.id === nodeId
        ? { ...node, keywords: node.keywords.filter(k => k !== keyword) }
        : node
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-background/40 backdrop-blur-xl rounded-xl border border-border/30 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-mono font-medium tracking-wide text-foreground">
              ANALYSIS NODES
            </h2>
            <p className="text-xs font-mono text-muted-foreground mt-1 tracking-wider">
              {nodes.length}/10 NODES CONFIGURED
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={saveNodes}
              disabled={nodes.length === 0}
              className="font-mono text-xs bg-background/50 border-border/50 hover:bg-background/80 hover:border-foreground/30"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              SAVE
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadNodes}
              className="font-mono text-xs bg-background/50 border-border/50 hover:bg-background/80 hover:border-foreground/30"
            >
              <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
              LOAD
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSavedNodes}
              className="font-mono text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <X className="w-3.5 h-3.5 mr-1.5" />
              CLEAR
            </Button>
          </div>
        </div>

        {/* Single Node Input */}
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Node name..."
            value={newNodeName}
            onChange={(e) => setNewNodeName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addNode()}
            disabled={nodes.length >= 10}
            className="font-mono text-sm bg-background/30 border-border/40 placeholder:text-muted-foreground/50 focus:border-foreground/50"
          />
          <Button 
            onClick={addNode}
            disabled={!newNodeName.trim() || nodes.length >= 10}
            className="font-mono text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            ADD
          </Button>
        </div>

        {/* Bulk Input */}
        <div className="space-y-3">
          <label className="text-xs font-mono text-muted-foreground tracking-wider">BULK IMPORT</label>
          <Textarea
            placeholder="Paste node names (one per line)..."
            value={bulkNodeText}
            onChange={(e) => setBulkNodeText(e.target.value)}
            disabled={nodes.length >= 10}
            className="min-h-[100px] font-mono text-sm bg-background/30 border-border/40 placeholder:text-muted-foreground/50 focus:border-foreground/50 resize-none"
          />
          <div className="flex gap-2">
            <Button 
              onClick={addBulkNodes}
              disabled={!bulkNodeText.trim() || nodes.length >= 10}
              variant="secondary"
              className="font-mono text-xs bg-background/50 hover:bg-background/80"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              IMPORT ALL
            </Button>
            {nodes.length > 0 && (
              <Button 
                onClick={generateAllKeywords}
                disabled={isGenerating}
                variant="outline"
                className="font-mono text-xs bg-background/50 border-border/50 hover:bg-background/80 hover:border-foreground/30"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                {isGenerating 
                  ? `GENERATING ${generatingProgress.current}/${generatingProgress.total}...` 
                  : 'GENERATE ALL KEYWORDS'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Nodes Grid */}
      <div className="grid gap-3">
        {nodes.map((node, index) => (
          <div 
            key={node.id} 
            className="group bg-background/30 backdrop-blur-sm rounded-lg border border-border/30 p-4 hover:border-border/50 hover:shadow-[0_0_20px_rgba(255,255,255,0.03)] transition-all duration-300"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground/60 w-6">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="font-mono text-sm font-medium text-foreground">{node.name}</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeNode(node.id)}
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Keywords */}
            <div className="flex flex-wrap gap-1.5 mb-3 ml-9">
              {node.keywords.length === 0 ? (
                <span className="text-xs font-mono text-muted-foreground/50 italic">No keywords</span>
              ) : (
                node.keywords.map((keyword) => (
                  <Badge 
                    key={keyword} 
                    variant="secondary" 
                    className="font-mono text-[10px] bg-background/50 border border-border/30 text-muted-foreground hover:bg-background/80 gap-1 px-2 py-0.5"
                  >
                    {keyword}
                    <button
                      onClick={() => removeKeyword(node.id, keyword)}
                      className="ml-0.5 hover:text-destructive transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </Badge>
                ))
              )}
            </div>

            {/* Add Keyword */}
            <div className="flex gap-2 ml-9">
              <Input
                placeholder="Add keyword..."
                value={newKeyword[node.id] || ''}
                onChange={(e) => setNewKeyword({ ...newKeyword, [node.id]: e.target.value })}
                onKeyPress={(e) => e.key === 'Enter' && addKeyword(node.id)}
                className="text-xs font-mono h-8 bg-background/20 border-border/30 placeholder:text-muted-foreground/40 focus:border-foreground/40"
              />
              <Button
                size="sm"
                onClick={() => addKeyword(node.id)}
                disabled={!newKeyword[node.id]?.trim()}
                className="h-8 px-3 font-mono text-xs"
              >
                ADD
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateKeywords(node.id)}
                disabled={isGenerating}
                className="h-8 w-8 p-0 bg-background/30 border-border/30 hover:bg-background/50 hover:border-foreground/30"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {nodes.length === 0 && (
        <div className="text-center py-12 bg-background/20 backdrop-blur-sm rounded-xl border border-dashed border-border/30">
          <div className="font-mono text-xs text-muted-foreground/60 tracking-wider">
            NO NODES CONFIGURED
          </div>
          <p className="text-xs text-muted-foreground/40 mt-2">
            Add your first analysis node above
          </p>
        </div>
      )}
    </div>
  );
}
