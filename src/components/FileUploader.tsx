import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileJson, FileText, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FileUploaderProps {
  onFileUpload: (content: any, fileType: 'reddit' | 'text') => void;
  disabled?: boolean;
}

export function FileUploader({ onFileUpload, disabled }: FileUploaderProps) {
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    try {
      const text = await file.text();
      
      // Try to parse as JSON (Reddit format)
      if (file.name.endsWith('.json')) {
        try {
          const json = JSON.parse(text);
          onFileUpload(json, 'reddit');
          toast({
            title: 'File uploaded',
            description: `Loaded ${json.length || 0} items from ${file.name}`,
          });
        } catch (err) {
          toast({
            title: 'Invalid JSON',
            description: 'Could not parse JSON file. Please check format.',
            variant: 'destructive',
          });
        }
      } else {
        // Handle as text file
        const lines = text.split('\n\n').filter(l => l.trim());
        onFileUpload(lines, 'text');
        toast({
          title: 'File uploaded',
          description: `Loaded ${lines.length} text entries`,
        });
      }
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: 'Could not read file contents',
        variant: 'destructive',
      });
    }
  };

  const clearFile = () => {
    setFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Upload Data</h3>
          <p className="text-sm text-muted-foreground">
            Upload Reddit JSON files, research papers (PDF), or plain text data
          </p>
        </div>

        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.txt,.pdf,.csv"
            onChange={handleFileChange}
            className="hidden"
            disabled={disabled}
          />
          
          {fileName ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <FileJson className="w-8 h-8 text-primary" />
                <div className="text-left">
                  <div className="font-medium">{fileName}</div>
                  <div className="text-xs text-muted-foreground">Ready to analyze</div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearFile}
                className="gap-2"
              >
                <X className="w-4 h-4" />
                Remove
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
              <div>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Choose File
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Supports: JSON, TXT, PDF, CSV
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
