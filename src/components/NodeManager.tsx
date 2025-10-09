import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import type { Node } from '@/types/sentiment';

interface NodeManagerProps {
  nodes: Node[];
  onNodesChange: (nodes: Node[]) => void;
}

export function NodeManager({ nodes, onNodesChange }: NodeManagerProps) {
  const [newNodeName, setNewNodeName] = useState('');
  const [newKeyword, setNewKeyword] = useState<Record<string, string>>({});

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
          <h2 className="text-xl font-semibold mb-4">Define Analysis Nodes</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Create up to 10 topic nodes with keywords for classification
          </p>

          <div className="flex gap-2 mb-6">
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
