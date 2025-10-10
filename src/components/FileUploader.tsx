import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileJson, FileText, X, Trash2, Link as LinkIcon, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { extractTextFromPDF } from '@/utils/pdfParser';
import { useNavigate } from 'react-router-dom';
import type { User, Session } from '@supabase/supabase-js';

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
  const [redditUrls, setRedditUrls] = useState('');
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Get current user
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Load saved sources
  useEffect(() => {
    if (user) {
      loadSavedSources();
    }
  }, [user]);

  const loadSavedSources = async () => {
    if (!user) return;
    
    setIsLoadingSources(true);
    try {
      const { data, error } = await supabase
        .from('data_sources')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const loadedFiles: UploadedFile[] = data.map(source => ({
          name: source.name,
          type: source.source_type === 'reddit_url' || source.source_type === 'reddit_json' ? 'reddit' : 'text',
          content: source.content,
          itemCount: source.item_count,
        }));
        
        setUploadedFiles(loadedFiles);
        mergeAndNotify(loadedFiles);
        
        toast({
          title: 'Sources loaded',
          description: `Loaded ${data.length} saved source(s)`,
        });
      }
    } catch (error) {
      console.error('Error loading sources:', error);
    } finally {
      setIsLoadingSources(false);
    }
  };

  const saveSource = async (file: UploadedFile) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('data_sources')
        .insert({
          user_id: user.id,
          name: file.name,
          source_type: file.type === 'reddit' ? 'reddit_url' : 'text',
          content: file.content,
          item_count: file.itemCount,
        });
      
      if (error) throw error;
    } catch (error) {
      console.error('Error saving source:', error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

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
      
      // Save each file to database
      for (const file of newFiles) {
        await saveSource(file);
      }
      
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

  const removeFile = async (index: number) => {
    const fileName = uploadedFiles[index].name;
    const updatedFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(updatedFiles);
    mergeAndNotify(updatedFiles);
    
    // Remove from database
    if (user) {
      try {
        await supabase
          .from('data_sources')
          .delete()
          .eq('user_id', user.id)
          .eq('name', fileName);
      } catch (error) {
        console.error('Error removing source:', error);
      }
    }
    
    toast({
      title: 'File removed',
      description: `${fileName} removed`,
    });
  };

  const clearAllFiles = async () => {
    setUploadedFiles([]);
    onFilesChange([], 'text');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Clear from database
    if (user) {
      try {
        await supabase
          .from('data_sources')
          .delete()
          .eq('user_id', user.id);
      } catch (error) {
        console.error('Error clearing sources:', error);
      }
    }
    
    toast({
      title: 'All files cleared',
      description: 'Upload new files to begin analysis',
    });
  };

  const handleRedditUrls = async () => {
    const urls = redditUrls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);
    
    if (urls.length === 0) return;
    
    setIsScrapingUrl(true);
    let successCount = 0;
    
    for (const url of urls) {
      try {
        const { data, error } = await supabase.functions.invoke('scrape-reddit', {
          body: { url }
        });
        
        if (error) throw error;
        if (!data.success) throw new Error(data.error);
        
        const newFile: UploadedFile = {
          name: `Reddit: ${new URL(url).pathname}`,
          content: data.texts,
          itemCount: data.itemCount,
          type: 'reddit'
        };
        
        const updatedFiles = [...uploadedFiles, newFile];
        setUploadedFiles(updatedFiles);
        await saveSource(newFile);
        mergeAndNotify(updatedFiles);
        successCount++;
      } catch (error) {
        console.error(`Error scraping ${url}:`, error);
        toast({
          title: "Error",
          description: `Failed to scrape: ${url}`,
          variant: "destructive",
        });
      }
    }
    
    setRedditUrls('');
    
    if (successCount > 0) {
      toast({
        title: "Reddit data scraped",
        description: `Successfully extracted data from ${successCount} of ${urls.length} URL(s)`,
      });
    }
    
    setIsScrapingUrl(false);
  };

  if (!user) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">Loading...</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-2">Upload Data</h3>
            <p className="text-sm text-muted-foreground">
              Upload Reddit JSON files, research papers (PDF), or plain text data
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
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
            <p className="text-sm font-medium mb-3">Or scrape from Reddit URLs (Free!)</p>
            <div className="space-y-2">
              <Textarea
                placeholder="Paste multiple Reddit URLs (one per line):&#10;https://www.reddit.com/r/science/...&#10;https://www.reddit.com/r/technology/..."
                value={redditUrls}
                onChange={(e) => setRedditUrls(e.target.value)}
                disabled={disabled || isScrapingUrl}
                className="min-h-[100px] font-mono text-sm"
              />
              <Button
                onClick={handleRedditUrls}
                disabled={!redditUrls.trim() || disabled || isScrapingUrl}
                variant="secondary"
                className="w-full"
              >
                <LinkIcon className="w-4 h-4 mr-2" />
                {isScrapingUrl ? 'Scraping...' : `Scrape ${redditUrls.split('\n').filter(u => u.trim()).length} URL(s)`}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Enter Reddit post, subreddit, or user URLs to extract text data (one per line)
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
