import { useState, useEffect } from 'react';
import type { RedditData } from '@/types/reddit';
import { toast } from '@/hooks/use-toast';

const STORAGE_KEY = 'scrape_history';
const MAX_SCRAPES = 10; // Reduced from 20 to prevent quota issues

export interface ScrapeRecord {
  id: string;
  name: string;
  created_at: string;
  item_count: number;
  // Only store lightweight metadata, not full content
  metadata: {
    subredditStats?: Record<string, { posts: number; comments: number }>;
    timeRange?: string;
    sortMode?: string;
    scrapedAt?: string;
    totalSubreddits?: number;
    fastMode?: boolean;
    postCount?: number;
    commentCount?: number;
  };
}

// Separate in-memory cache for full content (not persisted)
const contentCache = new Map<string, { posts?: any[]; comments?: any[] }>();

export function useScrapeHistory() {
  const [scrapes, setScrapes] = useState<ScrapeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Migrate old format if needed
        const migrated = parsed.map((s: any) => {
          if (s.content) {
            // Old format - extract metadata only
            return {
              id: s.id,
              name: s.name,
              created_at: s.created_at,
              item_count: s.item_count,
              metadata: {
                subredditStats: s.content.subredditStats,
                timeRange: s.content.timeRange,
                sortMode: s.content.sortMode,
                scrapedAt: s.content.scrapedAt,
                totalSubreddits: s.content.totalSubreddits,
                fastMode: s.content.fastMode,
                postCount: s.content.posts?.length || 0,
                commentCount: s.content.comments?.length || 0,
              },
            };
          }
          return s;
        });
        setScrapes(migrated);
        // Re-save migrated data to clear old bloated format
        if (parsed.some((s: any) => s.content)) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated.slice(0, MAX_SCRAPES)));
        }
      }
    } catch (error) {
      console.error('Error loading scrape history:', error);
      // If corrupted, clear it
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save to localStorage with quota handling
  const persistScrapes = (newScrapes: ScrapeRecord[]) => {
    try {
      const trimmed = newScrapes.slice(0, MAX_SCRAPES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      setScrapes(trimmed);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('Storage quota exceeded, clearing old entries');
        // Try with fewer items
        const reduced = newScrapes.slice(0, 5);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced));
          setScrapes(reduced);
          toast({
            title: 'Storage limit reached',
            description: 'Older scrape history was removed to make space.',
            variant: 'default',
          });
        } catch {
          // Last resort - clear everything
          localStorage.removeItem(STORAGE_KEY);
          setScrapes([]);
        }
      } else {
        console.error('Error saving scrape history:', error);
      }
    }
  };

  // Add scrape - stores full content in memory cache, only metadata to localStorage
  const addScrape = (
    scrape: Omit<ScrapeRecord, 'id' | 'created_at' | 'metadata'> & {
      content?: { posts?: any[]; comments?: any[]; [key: string]: any };
    }
  ) => {
    const id = crypto.randomUUID();
    const content = scrape.content || {};
    
    // Cache full content in memory
    contentCache.set(id, {
      posts: content.posts,
      comments: content.comments,
    });

    // Only persist lightweight metadata
    const newScrape: ScrapeRecord = {
      id,
      name: scrape.name,
      item_count: scrape.item_count,
      created_at: new Date().toISOString(),
      metadata: {
        subredditStats: content.subredditStats,
        timeRange: content.timeRange,
        sortMode: content.sortMode,
        scrapedAt: content.scrapedAt,
        totalSubreddits: content.totalSubreddits,
        fastMode: content.fastMode,
        postCount: content.posts?.length || 0,
        commentCount: content.comments?.length || 0,
      },
    };
    
    persistScrapes([newScrape, ...scrapes]);
    return id;
  };

  const deleteScrape = (id: string) => {
    contentCache.delete(id);
    persistScrapes(scrapes.filter(s => s.id !== id));
  };

  // Get data from memory cache - returns null if not in cache (old scrapes)
  const getScrapeData = (id: string): RedditData[] | null => {
    const cached = contentCache.get(id);
    if (cached) {
      const posts = cached.posts || [];
      const comments = cached.comments || [];
      return [...posts, ...comments] as RedditData[];
    }
    // Data not in cache - was from a previous session
    return null;
  };

  const clearHistory = () => {
    contentCache.clear();
    persistScrapes([]);
  };

  // Check if scrape data is available (in memory)
  const hasData = (id: string): boolean => {
    return contentCache.has(id);
  };

  return {
    scrapes,
    isLoading,
    addScrape,
    deleteScrape,
    getScrapeData,
    clearHistory,
    hasData,
  };
}
