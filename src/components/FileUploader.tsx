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
  onFilesLoaded: (allContent: any[], fileType: 'reddit' | 'text', fileCount: number) => void;
  disabled?: boolean;
}

export function FileUploader({ onFilesLoaded, disabled }: FileUploaderProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [redditUrls, setRedditUrls] = useState('');
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
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

  // Load saved sources once when user is available
  useEffect(() => {
    if (user && !sourcesLoaded) {
      loadSavedSources();
    }
  }, [user]);

  const loadSavedSources = async () => {
    if (!user || sourcesLoaded || isLoadingSources) return;
    
    setIsLoadingSources(true);
    try {
      const { data, error } = await supabase
        .from('data_sources')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        // Validate and filter out corrupted sources
        const validFiles: UploadedFile[] = [];
        const corruptedIds: string[] = [];
        
        for (const source of data) {
          try {
            // Check if Reddit data has valid structure
            if (source.source_type === 'reddit_url' || source.source_type === 'reddit_json') {
              const content = source.content;
              // If it's an array of strings (old format), mark as corrupted
              if (Array.isArray(content) && content.length > 0 && typeof content[0] === 'string') {
                corruptedIds.push(source.id);
                continue;
              }
              // If it's properly structured Reddit data, validate timestamps
              if (Array.isArray(content) && content.length > 0) {
                const hasValidTimestamp = content.some((item: any) => {
                  try {
                    const date = new Date(item.createdAt);
                    return !isNaN(date.getTime());
                  } catch {
                    return false;
                  }
                });
                if (!hasValidTimestamp) {
                  corruptedIds.push(source.id);
                  continue;
                }
              }
            }
            
            validFiles.push({
              name: source.name,
              type: source.source_type === 'reddit_url' || source.source_type === 'reddit_json' ? 'reddit' : 'text',
              content: source.content,
              itemCount: source.item_count,
            });
          } catch (validationError) {
            console.error('Error validating source:', validationError);
            corruptedIds.push(source.id);
          }
        }
        
        // Delete corrupted sources
        if (corruptedIds.length > 0) {
          console.log(`Removing ${corruptedIds.length} corrupted sources`);
          await supabase
            .from('data_sources')
            .delete()
            .in('id', corruptedIds);
          
          toast({
            title: 'Cleaned up corrupted data',
            description: `Removed ${corruptedIds.length} invalid source(s). Please re-upload them.`,
          });
        }
        
        if (validFiles.length > 0) {
          setUploadedFiles(validFiles);
          notifyParent(validFiles);
          
          toast({
            title: 'Sources loaded',
            description: `Loaded ${validFiles.length} valid source(s). Click "Start Analysis" when ready.`,
          });
        } else if (corruptedIds.length > 0) {
          setUploadedFiles([]);
          onFilesLoaded([], 'text', 0);
        }
      }
      
      setSourcesLoaded(true);
    } catch (error) {
      console.error('Error loading sources:', error);
      toast({
        title: 'Error loading sources',
        description: 'Failed to load saved sources.',
        variant: 'destructive'
      });
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
    let processedCount = 0;
    let failedCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
          // Handle PDF files
          if (file.name.endsWith('.pdf')) {
            toast({
              title: 'Processing PDF',
              description: `Extracting text from ${file.name} (${i + 1}/${files.length})...`,
            });

            try {
              const pdfTexts = await extractTextFromPDF(file);
              
              // Validate extracted text
              if (!pdfTexts || pdfTexts.length === 0) {
                throw new Error('No text extracted from PDF');
              }
              
              // Sanitize PDF text to remove null bytes and other problematic characters
              const sanitizedTexts = pdfTexts.map(text => 
                text.replace(/\u0000/g, '') // Remove null bytes
                    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove other control characters
                    .trim()
              ).filter(text => text.length > 0);
              
              if (sanitizedTexts.length === 0) {
                throw new Error('No valid text after cleaning');
              }
              
              newFiles.push({
                name: file.name,
                type: 'text',
                content: sanitizedTexts,
                itemCount: sanitizedTexts.length,
              });
              
              processedCount++;
              
              toast({
                title: 'PDF processed',
                description: `Extracted ${sanitizedTexts.length} pages from ${file.name}`,
              });
              
              // Small delay between PDFs to prevent memory overflow
              if (i < files.length - 1 && files[i + 1]?.name.endsWith('.pdf')) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            } catch (pdfError) {
              console.error('PDF parsing error:', pdfError);
              failedCount++;
              toast({
                title: 'PDF parsing failed',
                description: `Could not extract text from ${file.name}. ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`,
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
              processedCount++;
            } catch (err) {
              failedCount++;
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
            processedCount++;
          }
        } catch (err) {
          failedCount++;
          console.error(`Error processing ${file.name}:`, err);
          toast({
            title: 'Upload failed',
            description: `Could not read ${file.name}. ${err instanceof Error ? err.message : 'Unknown error'}`,
            variant: 'destructive',
          });
        }
      }

      if (newFiles.length > 0) {
        const updatedFiles = [...uploadedFiles, ...newFiles];
        setUploadedFiles(updatedFiles);
        
        // Save each file to database
        for (const file of newFiles) {
          try {
            await saveSource(file);
          } catch (saveError) {
            console.error('Error saving source:', saveError);
          }
        }
        
        // Notify parent without triggering analysis
        notifyParent(updatedFiles);

        const summary = failedCount > 0 
          ? `Added ${newFiles.length} file(s), ${failedCount} failed. Total: ${updatedFiles.length} sources ready.`
          : `Added ${newFiles.length} file(s). Total: ${updatedFiles.length} sources ready.`;

        toast({
          title: 'Upload complete',
          description: summary + ' Click "Start Analysis" when ready.',
        });
      } else if (failedCount > 0) {
        toast({
          title: 'No files uploaded',
          description: `All ${failedCount} file(s) failed to process.`,
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Critical error in file upload:', err);
      toast({
        title: 'Upload error',
        description: 'A critical error occurred during file upload. Please try again with fewer files.',
        variant: 'destructive',
      });
    } finally {
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const notifyParent = (files: UploadedFile[]) => {
    if (files.length === 0) {
      onFilesLoaded([], 'text', 0);
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

    onFilesLoaded(mergedContent, fileType, files.length);
  };

  const removeFile = async (index: number) => {
    const fileName = uploadedFiles[index].name;
    const updatedFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(updatedFiles);
    notifyParent(updatedFiles);
    
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
    onFilesLoaded([], 'text', 0);
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
          content: data.data, // Now returns structured Reddit data
          itemCount: data.itemCount,
          type: 'reddit'
        };
        
        const updatedFiles = [...uploadedFiles, newFile];
        setUploadedFiles(updatedFiles);
        await saveSource(newFile);
        notifyParent(updatedFiles);
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
        description: `Successfully extracted data from ${successCount} of ${urls.length} URL(s). Click "Start Analysis" when ready.`,
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

        <div className="space-y-3">
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

          <div className="pt-3 border-t">
            <p className="text-sm font-medium mb-2">Or scrape from Reddit URLs (Free!)</p>
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
