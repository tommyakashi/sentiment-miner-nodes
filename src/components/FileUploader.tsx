import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Upload, FileJson, FileText, X, Trash2, Link as LinkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { extractTextFromPDF } from '@/utils/pdfParser';

interface UploadedFile {
  name: string;
  type: 'reddit' | 'text';
  content: any;
  itemCount: number;
}

interface FileUploaderProps {
  onFilesChange: (allContent: any[], fileType: 'reddit' | 'text') => void;
  disabled?: boolean;
}

export function FileUploader({ onFilesChange, disabled }: FileUploaderProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [redditUrl, setRedditUrl] = useState('');
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: UploadedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        // Handle PDF files
        if (file.name.endsWith('.pdf')) {
          toast({
            title: 'Processing PDF',
            description: `Extracting text from ${file.name}...`,
          });

          try {
            const pdfTexts = await extractTextFromPDF(file);
            newFiles.push({
              name: file.name,
              type: 'text',
              content: pdfTexts,
              itemCount: pdfTexts.length,
            });
            
            toast({
              title: 'PDF processed',
              description: `Extracted ${pdfTexts.length} pages from ${file.name}`,
            });
          } catch (pdfError) {
            console.error('PDF parsing error:', pdfError);
            toast({
              title: 'PDF parsing failed',
              description: `Could not extract text from ${file.name}`,
              variant: 'destructive',
            });
          }
          continue;
        }

        const text = await file.text();
        
        // Try to parse as JSON (Reddit format)
        if (file.name.endsWith('.json')) {
          try {
            const json = JSON.parse(text);
            newFiles.push({
              name: file.name,
              type: 'reddit',
              content: json,
              itemCount: json.length || 0,
            });
          } catch (err) {
            toast({
              title: 'Invalid JSON',
              description: `Could not parse ${file.name}. Skipping.`,
              variant: 'destructive',
            });
          }
        } else {
          // Handle as text file
          const lines = text.split('\n\n').filter(l => l.trim());
          newFiles.push({
            name: file.name,
            type: 'text',
            content: lines,
            itemCount: lines.length,
          });
        }
      } catch (err) {
        toast({
          title: 'Upload failed',
          description: `Could not read ${file.name}`,
          variant: 'destructive',
        });
      }
    }

    if (newFiles.length > 0) {
      const updatedFiles = [...uploadedFiles, ...newFiles];
      setUploadedFiles(updatedFiles);
      
      // Merge all content and notify parent
      mergeAndNotify(updatedFiles);

      toast({
        title: 'Files uploaded',
        description: `Added ${newFiles.length} file(s). Total: ${updatedFiles.length}`,
      });
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const mergeAndNotify = (files: UploadedFile[]) => {
    if (files.length === 0) {
      onFilesChange([], 'text');
      return;
    }

    // Determine primary type (reddit if any reddit files exist)
    const hasReddit = files.some(f => f.type === 'reddit');
    const fileType = hasReddit ? 'reddit' : 'text';

    // Merge all content
    let mergedContent: any[] = [];
    files.forEach(file => {
      if (Array.isArray(file.content)) {
        mergedContent = [...mergedContent, ...file.content];
      } else {
        mergedContent.push(file.content);
      }
    });

    onFilesChange(mergedContent, fileType);
  };

  const removeFile = (index: number) => {
    const updatedFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(updatedFiles);
    mergeAndNotify(updatedFiles);
    
    toast({
      title: 'File removed',
      description: `${uploadedFiles[index].name} removed`,
    });
  };

  const clearAllFiles = () => {
    setUploadedFiles([]);
    onFilesChange([], 'text');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast({
      title: 'All files cleared',
      description: 'Upload new files to begin analysis',
    });
  };

  const handleRedditUrl = async () => {
    if (!redditUrl.trim()) return;
    
    setIsScrapingUrl(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-reddit', {
        body: { url: redditUrl }
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      const newFile: UploadedFile = {
        name: `Reddit: ${new URL(redditUrl).pathname}`,
        content: data.texts,
        itemCount: data.itemCount,
        type: 'reddit'
      };
      
      const updatedFiles = [...uploadedFiles, newFile];
      setUploadedFiles(updatedFiles);
      mergeAndNotify(updatedFiles);
      setRedditUrl('');
      
      toast({
        title: "Reddit data scraped",
        description: `Extracted ${data.itemCount} items from Reddit`,
      });
    } catch (error) {
      console.error('Error scraping Reddit:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to scrape Reddit URL",
        variant: "destructive",
      });
    } finally {
      setIsScrapingUrl(false);
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

        <div className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.txt,.pdf,.csv"
              onChange={handleFileChange}
              className="hidden"
              disabled={disabled}
              multiple
            />
            
            <div className="space-y-3">
              <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
              <div>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload Files
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Supports: PDF, JSON, TXT, CSV • Multiple files allowed
              </p>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Or scrape from Reddit URL (Free!)</p>
            <div className="flex gap-2">
              <Input
                placeholder="https://www.reddit.com/r/science/..."
                value={redditUrl}
                onChange={(e) => setRedditUrl(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !disabled && handleRedditUrl()}
                disabled={disabled || isScrapingUrl}
                className="flex-1"
              />
              <Button
                onClick={handleRedditUrl}
                disabled={!redditUrl.trim() || disabled || isScrapingUrl}
                variant="secondary"
              >
                <LinkIcon className="w-4 h-4 mr-2" />
                {isScrapingUrl ? 'Scraping...' : 'Scrape'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Enter a Reddit post, subreddit, or user URL to extract text data
            </p>
          </div>

          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <Card className="p-4 bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-sm">
                  Uploaded Files ({uploadedFiles.length})
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFiles}
                  className="h-8 gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </Button>
              </div>
              
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-2 p-2 bg-background rounded-lg"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {file.type === 'reddit' ? (
                          <FileJson className="w-4 h-4 text-primary flex-shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-secondary flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{file.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {file.itemCount} items
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {file.type}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}
        </div>
      </div>
    </Card>
  );
}
