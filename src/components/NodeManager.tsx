import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
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

  // Load nodes from localStorage on mount - run immediately
  useEffect(() => {
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
  }, [onNodesChange]);

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
    let successCount = 0;
    const updatedNodes = [...nodes];

    for (let i = 0; i < updatedNodes.length; i++) {
      const node = updatedNodes[i];
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
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Define Analysis Nodes</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={saveNodes}
                disabled={nodes.length === 0}
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadNodes}
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Load
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSavedNodes}
                className="text-destructive"
              >
                <X className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Create up to 10 topic nodes with keywords for classification
          </p>

          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Enter node name (e.g., Funding Access)"
              value={newNodeName}
              onChange={(e) => setNewNodeName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addNode()}
              disabled={nodes.length >= 10}
            />
            <Button 
              onClick={addNode}
              disabled={!newNodeName.trim() || nodes.length >= 10}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Node
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Or paste multiple nodes:</label>
            <Textarea
              placeholder="Paste node names here (one per line)&#10;&#10;Example:&#10;Funding Outlook & Sustainability&#10;Open Science & Transparency&#10;Collaboration & Community"
              value={bulkNodeText}
              onChange={(e) => setBulkNodeText(e.target.value)}
              disabled={nodes.length >= 10}
              className="min-h-[120px]"
            />
            <div className="flex gap-2">
              <Button 
                onClick={addBulkNodes}
                disabled={!bulkNodeText.trim() || nodes.length >= 10}
                variant="secondary"
              >
                <Upload className="w-4 h-4 mr-2" />
                Add All Nodes
              </Button>
              {nodes.length > 0 && (
                <Button 
                  onClick={generateAllKeywords}
                  disabled={isGenerating}
                  variant="outline"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {isGenerating ? 'Generating...' : 'Generate Keywords for All'}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {nodes.map((node) => (
            <Card key={node.id} className="p-4 bg-muted/30">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-medium">{node.name}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeNode(node.id)}
                  className="h-6 w-6 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {node.keywords.map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="gap-1">
                    {keyword}
                    <button
                      onClick={() => removeKeyword(node.id, keyword)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Add keyword"
                  value={newKeyword[node.id] || ''}
                  onChange={(e) => setNewKeyword({ ...newKeyword, [node.id]: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && addKeyword(node.id)}
                  className="text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => addKeyword(node.id)}
                  disabled={!newKeyword[node.id]?.trim()}
                >
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generateKeywords(node.id)}
                  disabled={isGenerating}
                >
                  <Sparkles className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {nodes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No nodes defined yet. Add your first analysis node above.
          </div>
        )}
      </div>
    </Card>
  );
}
