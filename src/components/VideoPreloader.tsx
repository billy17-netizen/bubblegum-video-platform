"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';

interface VideoPreloaderProps {
  videoUrl: string;
  videoId: string;
  shouldPreload: boolean;
  priority: 'metadata' | 'partial' | 'full';
}

interface PreloadProgress {
  loaded: number;
  total: number;
  percentage: number;
  status: 'idle' | 'metadata' | 'loading' | 'ready' | 'error';
}

export default function VideoPreloader({ 
  videoUrl, 
  videoId, 
  shouldPreload, 
  priority 
}: VideoPreloaderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState<PreloadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0,
    status: 'idle'
  });

  // Memoize values to prevent unnecessary re-renders
  const memoizedVideoUrl = useMemo(() => videoUrl, [videoUrl]);
  const memoizedVideoId = useMemo(() => videoId, [videoId]);
  const memoizedPriority = useMemo(() => priority, [priority]);

  // Stable setProgress function to avoid update loops
  const updateProgressState = useCallback((updater: (prev: PreloadProgress) => PreloadProgress) => {
    setProgress(prev => {
      const newProgress = updater(prev);
      // Only update if something actually changed
      if (JSON.stringify(newProgress) === JSON.stringify(prev)) {
        return prev;
      }
      return newProgress;
    });
  }, []);

  // Preload berdasarkan priority dengan cache integration
  useEffect(() => {
    if (!shouldPreload || !videoRef.current) return;

    const video = videoRef.current;
    const abortController = new AbortController();

    const startPreload = async () => {
      try {
        updateProgressState(prev => ({ ...prev, status: 'metadata' }));
        
        // Check if service worker is available for cache integration
        const swRegistration = await navigator.serviceWorker?.ready;
        
        // Step 1: Load metadata first
        video.preload = 'metadata';
        video.src = memoizedVideoUrl;
        
        await new Promise((resolve, reject) => {
          const onLoadedMetadata = () => {
            updateProgressState(prev => ({ 
              ...prev, 
              status: 'loading',
              total: video.duration || 0 
            }));
            resolve(void 0);
          };
          
          const onError = (e: Event) => {
            updateProgressState(prev => ({ ...prev, status: 'error' }));
            reject(e);
          };

          video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
          video.addEventListener('error', onError, { once: true });
          
          // Cleanup if aborted
          abortController.signal.addEventListener('abort', () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            reject(new Error('Aborted'));
          });
        });

        // Step 2: Progressive loading based on priority with cache optimization
        if (memoizedPriority === 'partial' || memoizedPriority === 'full') {
          updateProgressState(prev => ({ ...prev, status: 'loading' }));
          
          // Notify service worker about video preloading
          if (swRegistration?.active) {
            swRegistration.active.postMessage({
              type: 'PRELOAD_VIDEO',
              videoUrl: memoizedVideoUrl,
              priority: memoizedPriority,
              videoId: memoizedVideoId
            });
          }
          
          // Monitor loading progress with throttling
          let rafId: number | null = null;
          let lastUpdateTime = 0;
          const throttleMs = 100; // Update at most every 100ms
          
          const updateProgress = () => {
            const now = performance.now();
            
            // Throttle updates
            if (now - lastUpdateTime < throttleMs) {
              if (!abortController.signal.aborted) {
                rafId = requestAnimationFrame(updateProgress);
              }
              return;
            }
            
            lastUpdateTime = now;
            
            if (video.buffered.length > 0) {
              const bufferedEnd = video.buffered.end(video.buffered.length - 1);
              const duration = video.duration || 1;
              const percentage = (bufferedEnd / duration) * 100;
              
              updateProgressState(prev => ({
                ...prev,
                loaded: bufferedEnd,
                total: duration,
                percentage: Math.min(percentage, 100)
              }));

              // For partial preload, stop at 30% or 10 seconds
              if (memoizedPriority === 'partial' && (percentage >= 30 || bufferedEnd >= 10)) {
                updateProgressState(prev => ({ ...prev, status: 'ready' }));
                
                // Store cache status for future optimization
                if ('caches' in window) {
                  caches.open('bubblegum-videos-v1').then(cache => {
                    cache.match(memoizedVideoUrl).then(response => {
                      if (response) {
                      }
                    });
                  });
                }
                
                if (rafId) cancelAnimationFrame(rafId);
                return;
              }
              
              // For full preload, continue until 100%
              if (memoizedPriority === 'full' && percentage >= 95) {
                updateProgressState(prev => ({ ...prev, status: 'ready' }));
                
                // Mark as fully cached
                if ('caches' in window) {
                  caches.open('bubblegum-videos-v1').then(cache => {
                    cache.match(memoizedVideoUrl).then(response => {
                      if (response) {
                      }
                    });
                  });
                }
                
                if (rafId) cancelAnimationFrame(rafId);
                return;
              }
            }
            
            // Continue monitoring if not aborted
            if (!abortController.signal.aborted) {
              rafId = requestAnimationFrame(updateProgress);
            }
          };

          // Start progressive loading with cache-aware strategy
          if (memoizedPriority === 'partial') {
            // Check if already cached first
            if ('caches' in window) {
              try {
                const cache = await caches.open('bubblegum-videos-v1');
                const cachedResponse = await cache.match(memoizedVideoUrl);
                
                if (cachedResponse) {
                  updateProgressState(prev => ({ ...prev, status: 'ready', percentage: 100 }));
                  return;
                }
              } catch (error) {
              }
            }
            
            // Load first 30% or 10 seconds
            video.preload = 'auto';
            video.currentTime = 0;
            
            // Trigger loading by attempting to play then pause
            const playPromise = video.play();
            if (playPromise) {
              playPromise.then(() => {
                video.pause();
                video.currentTime = 0;
                updateProgress();
              }).catch(() => {
                // Silent fail, continue with metadata only
                updateProgressState(prev => ({ ...prev, status: 'ready' }));
              });
            }
          } else if (memoizedPriority === 'full') {
            // Load entire video
            video.preload = 'auto';
            updateProgress();
          }
          
          // Cleanup function for this specific preload
          abortController.signal.addEventListener('abort', () => {
            if (rafId) {
              cancelAnimationFrame(rafId);
              rafId = null;
            }
          });
        } else {
          // Metadata only - still notify service worker for potential caching
          if (swRegistration?.active) {
            swRegistration.active.postMessage({
              type: 'PRELOAD_VIDEO',
              videoUrl: memoizedVideoUrl,
              priority: 'metadata',
              videoId: memoizedVideoId
            });
          }
          
          updateProgressState(prev => ({ ...prev, status: 'ready' }));
        }

      } catch (error) {
        if (!abortController.signal.aborted) {
          updateProgressState(prev => ({ ...prev, status: 'error' }));
        }
      }
    };

    startPreload();

    return () => {
      abortController.abort();
      if (videoRef.current) {
        videoRef.current.src = '';
        videoRef.current.load();
      }
    };
  }, [shouldPreload, memoizedVideoUrl, memoizedVideoId, memoizedPriority, updateProgressState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
        videoRef.current.load();
      }
    };
  }, []);

  return (
    <div className="hidden">
      <video
        ref={videoRef}
        muted
        playsInline
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      
      {/* Debug info (only in development) */}
      {process.env.NODE_ENV === 'development' && shouldPreload && (
        <div className="fixed top-4 right-4 bg-black/80 text-white text-xs p-2 rounded z-50">
          <div>Preloading: {memoizedVideoId.slice(0, 8)}...</div>
          <div>Status: {progress.status}</div>
          <div>Progress: {progress.percentage.toFixed(1)}%</div>
          <div>Priority: {memoizedPriority}</div>
        </div>
      )}
    </div>
  );
}

// Hook untuk menggunakan preloader
export function useVideoPreloader() {
  const [preloadQueue, setPreloadQueue] = useState<{
    videoId: string;
    videoUrl: string;
    priority: 'metadata' | 'partial' | 'full';
  }[]>([]);

  const addToPreloadQueue = useCallback((videoId: string, videoUrl: string, priority: 'metadata' | 'partial' | 'full' = 'metadata') => {
    setPreloadQueue(prev => {
      // Remove existing entry for same video
      const filtered = prev.filter(item => item.videoId !== videoId);
      // Add new entry
      return [...filtered, { videoId, videoUrl, priority }];
    });
  }, []);

  const removeFromPreloadQueue = useCallback((videoId: string) => {
    setPreloadQueue(prev => prev.filter(item => item.videoId !== videoId));
  }, []);

  const clearPreloadQueue = useCallback(() => {
    setPreloadQueue([]);
  }, []);

  return {
    preloadQueue,
    addToPreloadQueue,
    removeFromPreloadQueue,
    clearPreloadQueue
  };
} 
