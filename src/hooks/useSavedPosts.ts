import { useState, useEffect } from 'react';
import type { RedditPost } from '@/types/reddit';

const STORAGE_KEY = 'saved_posts';

export function useSavedPosts() {
  const [savedPosts, setSavedPosts] = useState<RedditPost[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSavedPosts(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading saved posts:', error);
    }
  }, []);

  // Save to localStorage whenever savedPosts changes
  const persistPosts = (posts: RedditPost[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
      setSavedPosts(posts);
    } catch (error) {
      console.error('Error saving posts:', error);
    }
  };

  const savePost = (post: RedditPost) => {
    if (!savedPosts.some(p => p.id === post.id)) {
      persistPosts([post, ...savedPosts]);
      return true;
    }
    return false;
  };

  const unsavePost = (postId: string) => {
    persistPosts(savedPosts.filter(p => p.id !== postId));
  };

  const isPostSaved = (postId: string) => {
    return savedPosts.some(p => p.id === postId);
  };

  const toggleSavePost = (post: RedditPost) => {
    if (isPostSaved(post.id)) {
      unsavePost(post.id);
      return false;
    } else {
      savePost(post);
      return true;
    }
  };

  return {
    savedPosts,
    savePost,
    unsavePost,
    isPostSaved,
    toggleSavePost,
  };
}
