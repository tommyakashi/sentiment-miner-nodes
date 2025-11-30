import { useState, useRef } from 'react';
import { Upload, FileText, Trash2, Clock, FileType, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface UploadedData {
  id: string;
  name: string;
  type: 'text' | 'csv' | 'txt';
  content: string[];
  uploadedAt: Date;
  itemCount: number;
}

interface ManualUploadProps {
  onDataReady: (content: any[], fileType: 'text', fileCount: number) => void;
}

export function ManualUpload({ onDataReady }: ManualUploadProps) {
  const [textInput, setTextInput] = useState('');
  const [uploadHistory, setUploadHistory] = useState<UploadedData[]>([]);
  const [selectedUpload, setSelectedUpload] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const parseTextInput = (text: string): string[] => {
    // Split by double newlines to separate entries
    return text
      .split(/\n\n+/)
      .map(entry => entry.trim())
      .filter(entry => entry.length > 0);
  };

  const handleTextSubmit = () => {
    const entries = parseTextInput(textInput);
    if (entries.length === 0) {
      toast({
        title: 'No content',
        description: 'Please enter some text to analyze.',
        variant: 'destructive',
      });
      return;
    }

    const upload: UploadedData = {
      id: Date.now().toString(),
      name: `Text Input ${new Date().toLocaleTimeString()}`,
      type: 'text',
      content: entries,
      uploadedAt: new Date(),
      itemCount: entries.length,
    };

    setUploadHistory(prev => [upload, ...prev]);
    onDataReady(entries, 'text', 1);
    setTextInput('');
    
    toast({
      title: 'Data staged',
      description: `${entries.length} entries ready for analysis.`,
    });
  };

  const handleFileUpload = async (file: File) => {
    const text = await file.text();
    let entries: string[] = [];
    let type: 'csv' | 'txt' = 'txt';

    if (file.name.endsWith('.csv')) {
      type = 'csv';
      // Parse CSV - assume each row is a separate entry
      const lines = text.split('\n').filter(line => line.trim());
      // Skip header if it looks like one
      const startIndex = lines[0]?.includes(',') && !lines[0].match(/^[0-9]/) ? 1 : 0;
      entries = lines.slice(startIndex).map(line => {
        // Take the first column or the whole line
        const cols = line.split(',');
        return cols[0]?.replace(/^["']|["']$/g, '').trim() || line.trim();
      }).filter(e => e.length > 0);
    } else {
      entries = parseTextInput(text);
    }

    if (entries.length === 0) {
      toast({
        title: 'Empty file',
        description: 'No valid content found in the file.',
        variant: 'destructive',
      });
      return;
    }

    const upload: UploadedData = {
      id: Date.now().toString(),
      name: file.name,
      type,
      content: entries,
      uploadedAt: new Date(),
      itemCount: entries.length,
    };

    setUploadHistory(prev => [upload, ...prev]);
    onDataReady(entries, 'text', 1);
    
    toast({
      title: 'File uploaded',
      description: `${entries.length} entries from ${file.name} ready for analysis.`,
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.txt') || file.name.endsWith('.csv'))) {
      handleFileUpload(file);
    } else {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a .txt or .csv file.',
        variant: 'destructive',
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const loadFromHistory = (upload: UploadedData) => {
    setSelectedUpload(upload.id);
    onDataReady(upload.content, 'text', 1);
    toast({
      title: 'Data loaded',
      description: `${upload.itemCount} entries from "${upload.name}" staged.`,
    });
  };

  const deleteFromHistory = (id: string) => {
    setUploadHistory(prev => prev.filter(u => u.id !== id));
    if (selectedUpload === id) {
      setSelectedUpload(null);
    }
  };

  const entryCount = parseTextInput(textInput).length;

  return (
    <div className="space-y-6">
      {/* Text Input Area */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="w-4 h-4 text-primary" />
          <span>Paste Interview Transcripts or Text Data</span>
        </div>
        
        <Textarea
          placeholder="Paste text here... Separate entries with blank lines.

Example:
First interview response or data entry goes here.

Second entry goes here, separated by a blank line.

Third entry..."
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          className="min-h-[200px] font-mono text-sm resize-none"
        />
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-mono">
            {entryCount} {entryCount === 1 ? 'entry' : 'entries'} detected
          </span>
          <Button
            onClick={handleTextSubmit}
            disabled={entryCount === 0}
            size="sm"
          >
            Stage for Analysis
          </Button>
        </div>
      </Card>

      {/* File Upload Zone */}
      <Card
        className={cn(
          "p-6 border-dashed border-2 transition-all cursor-pointer",
          isDragging 
            ? "border-primary bg-primary/5" 
            : "border-border hover:border-primary/50"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.csv"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="text-center space-y-2">
          <Upload className={cn(
            "w-8 h-8 mx-auto transition-colors",
            isDragging ? "text-primary" : "text-muted-foreground"
          )} />
          <p className="text-sm font-medium">
            {isDragging ? 'Drop file here' : 'Drop a file or click to upload'}
          </p>
          <p className="text-xs text-muted-foreground">
            Supports .txt and .csv files
          </p>
        </div>
      </Card>

      {/* Upload History */}
      {uploadHistory.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>Upload History</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {uploadHistory.length} items
            </span>
          </div>
          
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-2">
              {uploadHistory.map((upload) => (
                <div
                  key={upload.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all",
                    selectedUpload === upload.id
                      ? "border-primary/50 bg-primary/5"
                      : "border-border hover:border-primary/30"
                  )}
                >
                  <FileType className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{upload.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {upload.itemCount} entries • {upload.uploadedAt.toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => loadFromHistory(upload)}
                      className="text-xs"
                    >
                      Load
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteFromHistory(upload.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      )}

      {/* Info */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          Upload interview transcripts, survey responses, or any text data. 
          Separate individual entries with blank lines. Data is stored locally in this session.
        </p>
      </div>
    </div>
  );
}
