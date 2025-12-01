import { useState, useEffect, useCallback } from 'react';
import type { AcademicPaper, PaperScrapeRecord } from '@/types/paper';

const STORAGE_KEY = 'paper-scrape-history';
const MAX_SCRAPES = 20;

export function usePaperHistory() {
  const [scrapes, setScrapes] = useState<PaperScrapeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setScrapes(parsed);
        }
      }
    } catch (error) {
      console.error('Error loading paper history:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save to localStorage whenever scrapes change
  const saveScrapes = useCallback((newScrapes: PaperScrapeRecord[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newScrapes));
      setScrapes(newScrapes);
    } catch (error) {
      console.error('Error saving paper history:', error);
    }
  }, []);

  const addScrape = useCallback((scrapeData: Omit<PaperScrapeRecord, 'id' | 'created_at'>) => {
    const newScrape: PaperScrapeRecord = {
      id: `paper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      ...scrapeData,
    };

    const updated = [newScrape, ...scrapes].slice(0, MAX_SCRAPES);
    saveScrapes(updated);
    return newScrape;
  }, [scrapes, saveScrapes]);

  const deleteScrape = useCallback((id: string) => {
    const updated = scrapes.filter(s => s.id !== id);
    saveScrapes(updated);
  }, [scrapes, saveScrapes]);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setScrapes([]);
  }, []);

  return {
    scrapes,
    isLoading,
    addScrape,
    deleteScrape,
    clearHistory,
    refresh: () => {
      // For localStorage, just re-read
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setScrapes(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Error refreshing paper history:', error);
      }
    }
  };
}
