import { useState, useEffect } from 'react';
import type { RedditData } from '@/types/reddit';

const STORAGE_KEY = 'scrape_history';
const MAX_SCRAPES = 20;

export interface ScrapeRecord {
  id: string;
  name: string;
  created_at: string;
  item_count: number;
  content: {
    posts?: any[];
    comments?: any[];
    subredditStats?: Record<string, { posts: number; comments: number }>;
    timeRange?: string;
    sortMode?: string;
    scrapedAt?: string;
    totalSubreddits?: number;
    fastMode?: boolean;
  };
}

export function useScrapeHistory() {
  const [scrapes, setScrapes] = useState<ScrapeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setScrapes(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading scrape history:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save to localStorage
  const persistScrapes = (newScrapes: ScrapeRecord[]) => {
    try {
      // Keep only the most recent scrapes
      const trimmed = newScrapes.slice(0, MAX_SCRAPES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      setScrapes(trimmed);
    } catch (error) {
      console.error('Error saving scrape history:', error);
    }
  };

  const addScrape = (scrape: Omit<ScrapeRecord, 'id' | 'created_at'>) => {
    const newScrape: ScrapeRecord = {
      ...scrape,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    persistScrapes([newScrape, ...scrapes]);
    return newScrape.id;
  };

  const deleteScrape = (id: string) => {
    persistScrapes(scrapes.filter(s => s.id !== id));
  };

  const getScrapeData = (id: string): RedditData[] | null => {
    const scrape = scrapes.find(s => s.id === id);
    if (!scrape) return null;
    
    const posts = scrape.content?.posts || [];
    const comments = scrape.content?.comments || [];
    return [...posts, ...comments] as RedditData[];
  };

  const clearHistory = () => {
    persistScrapes([]);
  };

  return {
    scrapes,
    isLoading,
    addScrape,
    deleteScrape,
    getScrapeData,
    clearHistory,
  };
}
