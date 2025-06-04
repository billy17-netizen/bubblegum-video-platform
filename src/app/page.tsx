"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useInView } from "react-intersection-observer";
import VideoPlayer from "@/components/VideoPlayer";
import VideoPreloader, { useVideoPreloader } from "@/components/VideoPreloader";
import BottomNavigation from "@/components/BottomNavigation";
import MobileOnlyMessage from "@/components/MobileOnlyMessage";
import OnboardingModal from "@/components/OnboardingModal";
import { FaSpinner, FaHeart, FaRandom } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// Utility functions for cache management
const VIDEO_CACHE_KEY = 'bubblegum_video_cache';
const CACHE_VERSION_KEY = 'bubblegum_cache_version';
const CURRENT_CACHE_VERSION = '1.0';

// Global audio cleanup function to stop all videos completely
const stopAllVideos = (videoRefs: React.MutableRefObject<(HTMLVideoElement | null)[]>) => {
  videoRefs.current.forEach((videoElement, index) => {
    if (videoElement) {
      videoElement.pause();
      videoElement.muted = true;
      videoElement.currentTime = 0;
      
      try {
        videoElement.load();
      } catch (e) {
        // Ignore load errors
      }
      
      try {
        const audioContext = (window as any).audioContext || (window as any).webkitAudioContext;
        if (audioContext && audioContext.state === 'running') {
          audioContext.suspend();
        }
      } catch (e) {
        // Ignore audio context errors
      }
    }
  });
};

interface VideoData {
  id: string;
  title: string;
  description?: string;
  cloudinaryUrl?: string;
  cloudinaryPublicId?: string;
  googleDriveFileId?: string;
  googleDriveVideoUrl?: string;
  filePath?: string;
  thumbnail?: string;
  thumbnailUrl?: string;
  // Bunny.net fields
  bunnyVideoId?: string;
  bunnyStreamUrl?: string;
  bunnyThumbnailUrl?: string;
  storageType?: 'local' | 'cloudinary' | 'bunny' | 'googledrive';
  admin: {
    id: string;
    username: string;
  };
  likes: number;
  views: number;
  userLikes: any[];
  _count: {
    userLikes: number;
  };
}

// Video cache management functions
const saveVideosToCache = (videos: VideoData[]) => {
  try {
    const cacheData = {
      videos: videos,
      timestamp: Date.now(),
      version: CURRENT_CACHE_VERSION
    };
    
    localStorage.setItem(VIDEO_CACHE_KEY, JSON.stringify(cacheData));
    localStorage.setItem(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
  } catch (error) {
  }
};

const VIDEO_POSITION_KEY = 'bubblegum_video_position';

const saveVideoPosition = (position: number) => {
  try {
    localStorage.setItem(VIDEO_POSITION_KEY, position.toString());
  } catch (error) {
  }
};

const getVideoPosition = (): number => {
  try {
    const position = localStorage.getItem(VIDEO_POSITION_KEY);
    return position ? parseInt(position, 10) : 0;
  } catch (error) {
    return 0;
  }
};

const clearVideoPosition = () => {
  try {
    localStorage.removeItem(VIDEO_POSITION_KEY);
  } catch (error) {
  }
};

const getVideosFromCache = (): VideoData[] => {
  try {
    const cacheVersion = localStorage.getItem(CACHE_VERSION_KEY);
    if (cacheVersion !== CURRENT_CACHE_VERSION) {
      clearVideoCache();
      return [];
    }
    
    const cached = localStorage.getItem(VIDEO_CACHE_KEY);
    if (!cached) return [];
    
    const cacheData = JSON.parse(cached);
    
    // Check if cache is still valid (less than 1 hour old)
    const isValidCache = (Date.now() - cacheData.timestamp) < (60 * 60 * 1000);
    
    if (!isValidCache) {
      clearVideoCache();
      return [];
    }
    
    return cacheData.videos || [];
  } catch (error) {
    return [];
  }
};

const clearVideoCache = () => {
  try {
    localStorage.removeItem(VIDEO_CACHE_KEY);
    localStorage.removeItem(CACHE_VERSION_KEY);
  } catch (error) {
  }
};

const clearAllUserData = () => {
  try {
    clearVideoCache();
    clearVideoPosition();
    localStorage.removeItem('bubblegum_onboarding_seen');
  } catch (error) {
  }
};

// Enhanced custom hook for fetching videos with pagination
function useVideos() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);
  const VIDEOS_PER_BATCH = 10; // Load 10 videos at a time

  const loadVideosFromCache = useCallback(() => {
    const cachedVideos = getVideosFromCache();
    if (cachedVideos.length > 0) {
      setVideos(cachedVideos);
      setIsLoading(false);
      setError("");
      setCurrentOffset(cachedVideos.length);
      return true;
    }
    return false;
  }, []);

  const shuffleVideos = useCallback(() => {
    setVideos(prevVideos => {
      const shuffled = [...prevVideos];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    });
  }, []);

  const fetchVideos = useCallback(async (reset: boolean = true) => {
    if (reset && !cacheLoaded) {
      const hasCachedData = loadVideosFromCache();
      setCacheLoaded(true);
      
      if (hasCachedData) {
        // Load fresh data in background
        setTimeout(() => {
          fetchVideosFromServer(false, true, 0);
        }, 100);
        return;
      } else {
        await fetchVideosFromServer(reset, false, 0);
      }
    } else {
      await fetchVideosFromServer(reset, false, reset ? 0 : currentOffset);
    }
  }, [cacheLoaded, loadVideosFromCache, currentOffset]);

  const loadMoreVideos = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    await fetchVideosFromServer(false, false, currentOffset);
  }, [isLoadingMore, hasMore, currentOffset]);

  const fetchVideosFromServer = useCallback(async (
    reset: boolean = true, 
    isBackgroundRefresh: boolean = false,
    offset: number = 0
  ) => {
    const isLoadingInitial = reset && videos.length === 0;
    const isLoadingMoreVideos = !reset && !isBackgroundRefresh;
    
    if (!isBackgroundRefresh) {
      if (isLoadingInitial) {
        setIsLoading(true);
      } else if (isLoadingMoreVideos) {
        setIsLoadingMore(true);
      }
    }
    setError("");

    try {
      // Use pagination parameters
      const params = new URLSearchParams({
        limit: VIDEOS_PER_BATCH.toString(),
        offset: offset.toString()
      });
      
      const response = await fetch(`/api/videos?${params}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch videos");
      }
      
      const data = await response.json();
      
      // AGGRESSIVE DEDUPLICATION
      const uniqueVideos = (data.videos || []).reduce((acc: VideoData[], current: VideoData) => {
        const isDuplicate = acc.some(video => video.id === current.id);
        if (!isDuplicate) {
          acc.push(current);
        } else {
          console.warn(`🔄 [HomePage] Removed duplicate video from UI: ${current.id} - "${current.title}"`);
        }
        return acc;
      }, []);
      
      
      if (reset || isBackgroundRefresh) {
        setVideos(uniqueVideos);
        setCurrentOffset(uniqueVideos.length);
        if (!isBackgroundRefresh) {
          saveVideosToCache(uniqueVideos);
        }
      } else {
        // Append new videos
        setVideos(prevVideos => {
          const combined = [...prevVideos];
          uniqueVideos.forEach((newVideo: VideoData) => {
            if (!combined.some(existingVideo => existingVideo.id === newVideo.id)) {
              combined.push(newVideo);
            }
          });
          return combined;
        });
        setCurrentOffset(prev => prev + uniqueVideos.length);
      }
      
      // Update hasMore status
      setHasMore(data.pagination?.hasMore || false);
      
    } catch (error) {
      console.error("Error fetching videos:", error);
      if (!isBackgroundRefresh) {
        setError("Failed to load videos. Please try again later.");
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [videos.length, VIDEOS_PER_BATCH]);

  useEffect(() => {
    fetchVideos(true);
  }, []);

  return { 
    videos, 
    isLoading, 
    isLoadingMore,
    error, 
    hasMore,
    fetchVideos: () => fetchVideos(true),
    loadMoreVideos,
    cacheLoaded,
    refreshCache: () => {
      clearVideoCache();
      setCacheLoaded(false);
      setCurrentOffset(0);
      setHasMore(true);
      fetchVideos(true);
    },
    shuffleVideos
  };
}

// Custom hook for video scroll functionality
function useVideoScroll(totalVideos: number) {
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [hasRestoredPosition, setHasRestoredPosition] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoPlayerRefs = useRef<(HTMLVideoElement | null)[]>([]);
  
  useEffect(() => {
    videoPlayerRefs.current = videoPlayerRefs.current.slice(0, totalVideos);
  }, [totalVideos]);

  const scrollToVideo = useCallback((index: number) => {
    if (index >= 0 && index < totalVideos) {
      const videoElement = document.querySelector(`[data-video-index="${index}"]`);
      if (videoElement) {
        videoElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [totalVideos]);

  return {
    activeVideoIndex,
    setActiveVideoIndex,
    hasRestoredPosition,
    setHasRestoredPosition,
    containerRef,
    videoPlayerRefs,
    scrollToVideo
  };
}

// VideoItem component to render each video
function VideoItem({ 
  video, 
  index, 
  isActive,
  onInView,
  isFirstLoad,
  videoPlayerRefs,
  showOnboarding,
  isAutoScrollEnabled,
  onVideoEnd,
  hasUserInteracted,
  setHasUserInteracted,
  isScrollingToFirst,
  isRestoringPosition,
  onBackgroundHiddenChange,
  isBackgroundHidden
}: { 
  video: VideoData; 
  index: number; 
  isActive: boolean;
  onInView: (index: number) => void;
  isFirstLoad?: boolean;
  videoPlayerRefs: React.MutableRefObject<(HTMLVideoElement | null)[]>;
  showOnboarding?: boolean;
  isAutoScrollEnabled: boolean;
  onVideoEnd: (index: number) => void;
  hasUserInteracted: boolean;
  setHasUserInteracted: (value: boolean) => void;
  isScrollingToFirst: boolean;
  isRestoringPosition: boolean;
  onBackgroundHiddenChange?: (isHidden: boolean) => void;
  isBackgroundHidden: boolean;
}) {
  const { ref, inView } = useInView({
    threshold: 0.3,
    triggerOnce: false,
    rootMargin: '0px 0px 0px 0px'
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoPlayerRefs.current[index] = videoRef.current;
    }
    
    return () => {
      videoPlayerRefs.current[index] = null;
    };
  }, [videoPlayerRefs, index]);

  useEffect(() => {
    if (inView && !isRestoringPosition) {
      onInView(index);
    } else {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.muted = true;
        videoRef.current.currentTime = 0;
      }
    }
  }, [inView, index, onInView, isRestoringPosition]);

  useEffect(() => {
    if (isFirstLoad && index === 0 && !showOnboarding && !isRestoringPosition) {
      onInView(0);
    }
    if (isActive && !showOnboarding && isFirstLoad && !isRestoringPosition) {
      onInView(index);
    }
  }, [isFirstLoad, index, onInView, isActive, showOnboarding, isRestoringPosition]);

  const handlePlayStateChange = (isPlaying: boolean) => {
    if (isPlaying && !hasUserInteracted) {
      setHasUserInteracted(true);
    }
  };

  const handleVideoEnd = () => {
    onVideoEnd(index);
  };

  return (
    <div 
      key={`${video.id}-${index}`} 
      ref={ref}
      data-video-index={index}
      className="h-screen w-screen snap-start bg-black overflow-hidden relative"
    >
      <VideoPlayer
        videoId={video.id}
        videoData={video}
        thumbnail={video.thumbnail || video.thumbnailUrl}
        title={video.title}
        initialLikes={video._count?.userLikes || video.likes || 0}
        initialViews={video.views || 0}
        className="absolute inset-0 w-full h-full"
        autoPlay={isActive && !showOnboarding}
        isInView={isActive}
        onPlayStateChange={handlePlayStateChange}
        onVideoEnd={handleVideoEnd}
        isAutoScrollEnabled={isAutoScrollEnabled}
        isPausedFromRestore={isRestoringPosition}
        onBackgroundHiddenChange={onBackgroundHiddenChange}
        isBackgroundHidden={isActive ? isBackgroundHidden : false}
        ref={(el) => {
          videoPlayerRefs.current[index] = el;
        }}
      />
    
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [authChecked, setAuthChecked] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showShuffleNotification, setShowShuffleNotification] = useState(false);
  
  // Global state untuk hide background dari video player - per video ID
  const [isBackgroundHidden, setIsBackgroundHidden] = useState(false);
  const [videoHideStates, setVideoHideStates] = useState<Record<string, boolean>>({});
  
  const {
    videos,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    fetchVideos,
    loadMoreVideos,
    cacheLoaded,
    refreshCache,
    shuffleVideos
  } = useVideos();
  
  const {
    activeVideoIndex,
    setActiveVideoIndex,
    hasRestoredPosition,
    setHasRestoredPosition,
    containerRef,
    videoPlayerRefs,
    scrollToVideo
  } = useVideoScroll(videos.length);
  
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const initialLoadRef = useRef(true);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isScrollingToFirst, setIsScrollingToFirst] = useState(false);
  const [isRestoringPosition, setIsRestoringPosition] = useState(false);

  // Video preloader management
  const { 
    preloadQueue, 
    addToPreloadQueue, 
    removeFromPreloadQueue, 
    clearPreloadQueue 
  } = useVideoPreloader();

  // Callback untuk menerima perubahan hide background dari VideoPlayer
  const handleBackgroundHiddenChange = useCallback((isHidden: boolean) => {
    const currentVideoId = videos[activeVideoIndex]?.id;
    if (currentVideoId) {
      console.log('[HomePage] Setting hide background for video:', currentVideoId, 'to:', isHidden);
      setVideoHideStates(prev => ({
        ...prev,
        [currentVideoId]: isHidden
      }));
      setIsBackgroundHidden(isHidden);
    }
  }, [videos, activeVideoIndex]);

  // Handle client-side mounting to prevent hydration issues
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Global auto scroll toggle listener - FIXED missing implementation
  useEffect(() => {
    if (!isMounted) return;
    
    const handleAutoScrollToggle = () => {
      setIsAutoScrollEnabled(prev => {
        const newState = !prev;
        
        // Save to localStorage for persistence
        try {
          localStorage.setItem('bubblegum_auto_scroll_enabled', newState.toString());
        } catch (error) {
        }
        
        return newState;
      });
    };
    
    // Listen for toggle events from VideoPlayer components
    window.addEventListener('toggleAutoScroll', handleAutoScrollToggle);
    
    // Load saved preference on mount
    try {
      const savedPreference = localStorage.getItem('bubblegum_auto_scroll_enabled');
      if (savedPreference !== null) {
        setIsAutoScrollEnabled(savedPreference === 'true');
      }
    } catch (error) {
    }
    
    return () => {
      window.removeEventListener('toggleAutoScroll', handleAutoScrollToggle);
    };
  }, [isMounted]);

  // Smart video preloader based on current position - FIXED infinite loop
  useEffect(() => {
    if (!videos.length || !addToPreloadQueue) return;

    // Clear previous queue first to prevent conflicts
    clearPreloadQueue();

    // Get videos around current position for preloading
    const preloadVideos = [];
    
    // Add next video with high priority (partial preload)
    if (activeVideoIndex + 1 < videos.length) {
      preloadVideos.push({
        video: videos[activeVideoIndex + 1],
        priority: 'partial' as const
      });
    }
    
    // Add next 2 videos with metadata only
    for (let i = activeVideoIndex + 2; i < Math.min(activeVideoIndex + 4, videos.length); i++) {
      preloadVideos.push({
        video: videos[i],
        priority: 'metadata' as const
      });
    }

    // Add previous video with metadata (for back navigation)
    if (activeVideoIndex > 0) {
      preloadVideos.push({
        video: videos[activeVideoIndex - 1],
        priority: 'metadata' as const
      });
    }

    // Execute preloading
    preloadVideos.forEach(({ video, priority }) => {
      const videoUrl = video.cloudinaryUrl || video.googleDriveVideoUrl || video.filePath || `/api/videos/${video.id}/stream`;
      
      
      addToPreloadQueue(video.id, videoUrl, priority);
    });

  }, [activeVideoIndex, videos, addToPreloadQueue, clearPreloadQueue]);

  // Cleanup preload queue when component unmounts - FIXED infinite loop
  useEffect(() => {
    return () => {
      clearPreloadQueue();
    };
  }, [clearPreloadQueue]);

  // Handler for when a video comes into view - FIXED infinite loop
  const handleVideoInView = useCallback((index: number) => {
    if (isScrollingToFirst || isRestoringPosition) {
      return;
    }
    
    // Restore hide background state untuk video ini
    const videoId = videos[index]?.id;
    if (videoId) {
      const savedHideState = videoHideStates[videoId] || false;
      console.log('[HomePage] Video changed to index:', index, 'videoId:', videoId, '- Restoring hide background:', savedHideState);
      setIsBackgroundHidden(savedHideState);
    }
    
    setActiveVideoIndex(index);
    saveVideoPosition(index);
    
    // Trigger infinite scroll when user is near the end
    const remainingVideos = videos.length - index;
    if (remainingVideos <= 3 && hasMore && !isLoadingMore) {
      loadMoreVideos();
    }
  }, [setActiveVideoIndex, videos, videoHideStates, hasMore, isLoadingMore, loadMoreVideos, isScrollingToFirst, isRestoringPosition]);

  // Check authentication and redirect if not logged in - only after mounting
  useEffect(() => {
    if (!isMounted) return; // Wait for client-side mounting
    
    if (status === "loading") return;
    
    if (status === "unauthenticated") {
      clearAllUserData();
      
      const currentPath = window.location.pathname;
      const callbackUrl = currentPath === '/login' ? '/' : currentPath;
      
      router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
        } else {
      setAuthChecked(true);
      
      const hasSeenOnboarding = localStorage.getItem('bubblegum_onboarding_seen');
      if (!hasSeenOnboarding && session?.user) {
        setShowOnboarding(true);
      }
      
    }
  }, [status, router, session, isMounted]);

  // Handle onboarding close
  const handleOnboardingClose = () => {
    setShowOnboarding(false);
    localStorage.setItem('bubblegum_onboarding_seen', 'true');
    
    // Don't auto scroll - let user stay at current position
    setTimeout(() => {
      if (videos.length > 0 && authChecked) {
        // Just ensure we have the right active video index based on current scroll position
      }
    }, 500);
  };

  // Handle auto scroll to next video
  const handleVideoEnd = useCallback((videoIndex: number) => {
    
    if (!isAutoScrollEnabled) {
      return;
    }
    
    if (videoIndex === activeVideoIndex) {
      
      setTimeout(() => {
        const nextIndex = videoIndex + 1;
        if (nextIndex < videos.length) {
          const nextVideoElement = document.querySelector(`[data-video-index="${nextIndex}"]`);
          if (nextVideoElement) {
            nextVideoElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
          }
        } else {
        }
      }, 200);
    } else {
    }
  }, [isAutoScrollEnabled, activeVideoIndex, videos.length]);

  // Show loading state while mounting or checking authentication - FIXED hydration
  if (!isMounted || status === "loading" || !authChecked) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center max-w-md text-center px-4">
            <FaSpinner className="animate-spin text-4xl text-pink-500 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            Loading...
          </h2>
          <p className="text-gray-400 text-sm">
            Please wait while we prepare your experience
          </p>
          </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden font-chivo">
      {/* Onboarding Modal */}
      <OnboardingModal 
        isOpen={showOnboarding} 
        onClose={handleOnboardingClose} 
      />
      
      <div className="w-full h-screen" ref={containerRef}>
        {error ? (
          <div className="flex justify-center items-center h-screen bg-gray-900">
            <div className="text-center py-8 px-4 bg-gray-800 rounded-xl shadow-lg max-w-md mx-4">
              <div className="text-red-500 text-5xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-white mb-3">Something went wrong</h3>
              <p className="text-red-400 mb-6 text-sm">{error}</p>
              <button 
                onClick={fetchVideos} 
                className="w-full px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl hover:from-pink-600 hover:to-purple-600 transition-all shadow-lg transform active:scale-95"
              >
                🔄 Try Again
              </button>
            </div>
          </div>
        ) : videos.length === 0 && isLoading && !cacheLoaded ? (
          <div className="flex justify-center items-center h-screen bg-gray-900">
            <div className="flex flex-col items-center">
              <div className="relative">
                <FaSpinner className="animate-spin text-5xl text-pink-500 mb-6" />
                <div className="absolute inset-0 rounded-full border-2 border-pink-500/20 animate-pulse"></div>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Loading Videos</h3>
              <p className="text-gray-400 text-sm">Preparing your feed...</p>
            </div>
          </div>
        ) : videos.length === 0 && !isLoading && authChecked && !showOnboarding && !cacheLoaded ? (
          <div className="flex justify-center items-center h-screen bg-gray-900">
            <div className="text-center py-8 px-4 bg-gray-800 rounded-xl shadow-lg max-w-md mx-4">
              <div className="text-6xl mb-4">📱</div>
              <h2 className="text-xl font-bold text-white mb-3">No Videos Yet</h2>
              <p className="text-gray-400 mb-6">Check back later for awesome content!</p>
              <button 
                onClick={fetchVideos} 
                className="w-full px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl hover:from-pink-600 hover:to-purple-600 transition-all shadow-lg transform active:scale-95"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        ) : videos.length > 0 ? (
          <div className="snap-y snap-mandatory h-screen overflow-y-auto scrollbar-hide touch-scroll scroll-smooth">
            {videos.map((video, index) => (
              <VideoItem 
                key={`${video.id}-${index}`}
                video={video} 
                index={index}
                isActive={index === activeVideoIndex}
                onInView={handleVideoInView}
                isFirstLoad={isFirstLoad}
                videoPlayerRefs={videoPlayerRefs}
                showOnboarding={showOnboarding}
                isAutoScrollEnabled={isAutoScrollEnabled}
                onVideoEnd={handleVideoEnd}
                hasUserInteracted={hasUserInteracted}
                setHasUserInteracted={setHasUserInteracted}
                isScrollingToFirst={isScrollingToFirst}
                isRestoringPosition={isRestoringPosition}
                onBackgroundHiddenChange={handleBackgroundHiddenChange}
                isBackgroundHidden={index === activeVideoIndex ? isBackgroundHidden : false}
              />
            ))}
            
            {/* Infinite Scroll Loading Indicator */}
            {isLoadingMore && (
              <div className="h-screen w-screen flex items-center justify-center bg-black">
                <div className="flex flex-col items-center">
                  <FaSpinner className="animate-spin text-4xl text-pink-500 mb-4" />
                  <p className="text-white text-lg font-medium">Loading more videos...</p>
                  <p className="text-gray-400 text-sm mt-1">Keep scrolling for more content</p>
                </div>
              </div>
            )}
            
            {/* End of List Indicator */}
            {!hasMore && videos.length > 0 && (
              <div className="h-screen w-screen flex items-center justify-center bg-black">
                <div className="status-card text-center">
                  <div className="text-6xl mb-4">🎉</div>
                  <h2 className="text-2xl font-bold text-white mb-3">You've reached the end!</h2>
                  <p className="text-gray-300 mb-6">Thanks for watching all our videos</p>
                  <button 
                    onClick={refreshCache} 
                    className="btn-primary w-full"
                  >
                    🔄 Refresh Videos
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
      
      {/* Video Preloaders for next videos */}
      {preloadQueue.map((preloadItem) => {
        const video = videos.find(v => v.id === preloadItem.videoId);
        if (!video) return null;
        
        return (
          <VideoPreloader
            key={preloadItem.videoId}
            videoId={preloadItem.videoId}
            videoUrl={preloadItem.videoUrl}
            shouldPreload={true}
            priority={preloadItem.priority}
          />
        );
      })}
      
      {/* Shuffle Notification */}
      <AnimatePresence>
        {showShuffleNotification && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-black/90 backdrop-blur-md rounded-2xl p-4 border border-pink-500/30 shadow-2xl"
          >
            <div className="flex items-center space-x-3 text-white">
              <div className="p-3 bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-full">
                <FaRandom className="text-pink-400 text-lg" />
              </div>
              <div>
                <div className="font-semibold text-sm">Videos Shuffled!</div>
                <div className="text-xs text-white/70">Discover content in random order</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Bottom Navigation */}
      {!isBackgroundHidden && <BottomNavigation />}
      
      {/* Mobile Only Message for Desktop/Tablet Users */}
      <MobileOnlyMessage />
    </div>
  );
}

