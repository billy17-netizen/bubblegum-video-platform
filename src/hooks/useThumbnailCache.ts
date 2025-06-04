import { useState } from 'react';

interface ThumbnailCacheHook {
  clearCache: () => Promise<void>;
  refreshVideo: (videoId: string) => Promise<void>;
  scanThumbnails: () => Promise<any>;
  loading: boolean;
  error: string | null;
}

export function useThumbnailCache(): ThumbnailCacheHook {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiCall = async (action: string, data?: any) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/thumbnail-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, ...data }),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Operation failed');
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearCache = async () => {
    await apiCall('clear-all');
    // Force page refresh to show updated thumbnails
    window.location.reload();
  };

  const refreshVideo = async (videoId: string) => {
    await apiCall('refresh-video', { videoId });
  };

  const scanThumbnails = async () => {
    return await apiCall('scan-thumbnails');
  };

  return {
    clearCache,
    refreshVideo,
    scanThumbnails,
    loading,
    error,
  };
}