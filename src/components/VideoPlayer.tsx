"use client";

import { useState, useEffect, useRef, forwardRef, ForwardedRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaHeart, FaPlay, FaPause, FaMusic, FaEllipsisH, FaEye, FaUser, FaVolumeUp, FaVolumeMute, FaForward, FaBackward, FaArrowDown, FaRedo, FaVolumeDown, FaEyeSlash } from "react-icons/fa";
import { useSession } from "next-auth/react";
import { getVideoUrl, getThumbnailUrl, isCloudinaryVideo, getStorageProviderName, getSafeVideoUrlWithFallback, VideoData } from "@/lib/videoService.client";

interface VideoPlayerProps {
  videoId: string;
  videoUrl?: string; // Optional - will be computed if not provided
  videoData?: any; // Full video data object for service
  thumbnail?: string;
  title: string;
  initialLikes: number;
  initialViews: number;
  className?: string;
  autoPlay?: boolean;
  isInView?: boolean;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onVideoEnd?: () => void;
  isAutoScrollEnabled?: boolean;
  isPausedFromRestore?: boolean; // New prop to indicate paused from restoration
  onBackgroundHiddenChange?: (isHidden: boolean) => void; // Callback untuk hide background
  isBackgroundHidden?: boolean; // New prop for external state
}

const VideoPlayer = forwardRef(({
  videoId,
  videoUrl,
  videoData,
  thumbnail,
  title,
  initialLikes,
  initialViews,
  className = "",
  autoPlay = false,
  isInView = true,
  onPlayStateChange,
  onVideoEnd,
  isAutoScrollEnabled = false,
  isPausedFromRestore = false,
  onBackgroundHiddenChange,
  isBackgroundHidden = false,
}: VideoPlayerProps, ref: ForwardedRef<HTMLVideoElement>) => {
  const [isMounted, setIsMounted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedMuted = localStorage.getItem('bubblegum_video_muted');
      return savedMuted ? savedMuted === 'true' : true; // Default to muted for autoplay compliance
    }
    return true;
  });
  const [hasStarted, setHasStarted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(initialLikes);
  const [views, setViews] = useState(initialViews);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCaptionControls, setShowCaptionControls] = useState(false);
  const [showAnimatedCaptions, setShowAnimatedCaptions] = useState(true);
  // Double tap states
  const [showSkipAnimation, setShowSkipAnimation] = useState<'left' | 'right' | null>(null);
  const [lastTap, setLastTap] = useState<{ time: number; side: 'left' | 'right' } | null>(null);
  // Like animation state
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  // Auto scroll notification state
  const [showAutoScrollNotification, setShowAutoScrollNotification] = useState(false);
  const [userHasToggledMute, setUserHasToggledMute] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [localAutoScrollEnabled, setLocalAutoScrollEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bubblegum_auto_scroll_enabled') === 'true';
    }
    return false;
  });
  // Background visibility state - local only, resets on video change
  const [localIsBackgroundHidden, setLocalIsBackgroundHidden] = useState(false);
  // Volume control states with localStorage persistence - improved
  const [volume, setVolume] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedVolume = localStorage.getItem('bubblegum_video_volume');
      const initialVolume = savedVolume ? parseFloat(savedVolume) : 1;
      return initialVolume;
    }
    return 1;
  }); // Volume level from 0 to 1
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  
  // Progress tracking states for TikTok-style progress bar
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const playAttemptRef = useRef(false);
  const retryCountRef = useRef(0);
  const hasRecordedViewRef = useRef(false);
  const maxRetries = 3;
  const { data: session } = useSession();
  
  // Proper ref handling for both callback refs and ref objects
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Handle ref assignment properly with immediate volume application
  const setVideoRef = useCallback((element: HTMLVideoElement | null) => {
    // Set internal ref
    videoRef.current = element;
    
    // Handle forwarded ref
    if (ref) {
      if (typeof ref === 'function') {
        ref(element);
      } else {
        ref.current = element;
      }
    }
    
    // Apply volume settings immediately when ref is available
    if (element) {
      // Small delay to ensure element is fully initialized
      setTimeout(() => {
        if (element && !element.paused) {
          element.volume = volume;
          element.muted = isMuted;
        }
      }, 50);
    }
    
  }, [ref, volume, isMuted]);
  
  // Compute best video URL and thumbnail - memoized to prevent infinite loops
  const computedVideoUrl = useMemo(() => {
    return videoData ? getVideoUrl(videoData) : videoUrl;
  }, [videoData, videoUrl, videoId]);
  
  const computedThumbnail = useMemo(() => {
    return videoData ? getThumbnailUrl(videoData) : thumbnail;
  }, [videoData, thumbnail]);
  
  // Get optimal video dimensions based on container size
  const getOptimalVideoDimensions = useMemo(() => {
    if (typeof window === 'undefined') return { width: 720, height: 1280 };
    
    const containerWidth = Math.min(window.innerWidth, 500); // Max mobile width
    const containerHeight = Math.min(window.innerHeight, 800); // Max mobile height
    
    // Calculate optimal dimensions for mobile-first approach
    let optimalWidth = containerWidth;
    let optimalHeight = containerHeight;
    
    // For TikTok-style 9:16 aspect ratio
    const aspectRatio = 9 / 16;
    
    if (containerWidth / containerHeight > aspectRatio) {
      // Container is wider than video aspect ratio
      optimalWidth = containerHeight * aspectRatio;
    } else {
      // Container is taller than video aspect ratio  
      optimalHeight = containerWidth / aspectRatio;
    }
    
    // Round to common video resolutions for better caching
    if (optimalWidth <= 360) {
      return { width: 360, height: 640 }; // Low quality
    } else if (optimalWidth <= 480) {
      return { width: 480, height: 854 }; // Medium quality
    } else if (optimalWidth <= 720) {
      return { width: 720, height: 1280 }; // HD quality
    } else {
      return { width: 1080, height: 1920 }; // Full HD quality
    }
  }, []);

  // Enhanced video URL with quality parameters
  const optimizedVideoUrl = useMemo(() => {
    const baseUrl = computedVideoUrl;
    const { width, height } = getOptimalVideoDimensions;
    
    // Return null if no base URL available
    if (!baseUrl) {
      return null;
    }
    
    // FIXED: Filter out HLS URLs - if base URL is HLS, get MP4 alternatives
    if (baseUrl.includes('.m3u8') || baseUrl.includes('playlist')) {
      
      // Try to get MP4 alternatives from videoData if available
      if (videoData?.bunnyStreamUrl) {
        // Convert Bunny.net HLS to MP4
        const mp4Url = baseUrl.replace('/playlist.m3u8', '/play_720p.mp4');
        return mp4Url;
      }
      
      // Return null instead of fallback to streaming API
      return null;
    }
    
    // Skip streaming API URLs entirely
    if (baseUrl.includes('/api/videos/')) {
      return null;
    }
    
    // Skip private Cloudinary URLs that require authentication
    if (baseUrl.includes('cloudinary.com') && baseUrl.includes('/private/')) {
      return null;
    }
    
    // For Cloudinary URLs, add transformation parameters
    if (isCloudinaryVideo(videoData) && videoData && baseUrl.includes('cloudinary.com')) {
      const cloudinaryUrl = baseUrl;
      // Insert transformation parameters before the version or public_id
      const transformations = `w_${width},h_${height},c_fill,q_auto:good,f_auto`;
      const optimizedUrl = cloudinaryUrl.replace(/\/upload\//, `/upload/${transformations}/`);
      return optimizedUrl;
    }
    
    return baseUrl;
  }, [computedVideoUrl, getOptimalVideoDimensions, isCloudinaryVideo(videoData), videoData, videoId]);

  // Get additional fallback MP4 URLs from videoData
  const fallbackVideoUrls = useMemo(() => {
    const fallbacks: string[] = [];
    
    // If we have Bunny.net video, add different MP4 variations
    if (videoData?.bunnyStreamUrl && videoData.bunnyStreamUrl.includes('.m3u8')) {
      const baseUrl = videoData.bunnyStreamUrl.replace('/playlist.m3u8', '');
      const variations = [
        '/play_480p.mp4',
        '/play_360p.mp4', 
        '/play_1080p.mp4',
        '/play.mp4'
      ];
      
      variations.forEach(variation => {
        const url = `${baseUrl}${variation}`;
        if (url !== optimizedVideoUrl) {
          fallbacks.push(url);
        }
      });
    }
    
    // Add Cloudinary URL as fallback
    if (videoData?.cloudinaryUrl && videoData.cloudinaryUrl !== optimizedVideoUrl) {
      fallbacks.push(videoData.cloudinaryUrl);
    }
    
    // Add original video URL as fallback
    if (videoData?.videoUrl && videoData.videoUrl !== optimizedVideoUrl) {
      fallbacks.push(videoData.videoUrl);
    }
    
    // Filter out any HLS URLs from fallbacks
    const validFallbacks = fallbacks.filter(url => 
      url && !url.includes('.m3u8') && !url.includes('playlist')
    );
    
    return validFallbacks;
  }, [videoData, optimizedVideoUrl, videoId]);

  const isCloudinarySource = useMemo(() => {
    return videoData ? isCloudinaryVideo(videoData) : false;
  }, [videoData]);
  
  const storageProviderName = useMemo(() => {
    return videoData ? getStorageProviderName(videoData) : 'Local Storage';
  }, [videoData]);
  
  const storageType = useMemo(() => {
    return storageProviderName;
  }, [storageProviderName]);
  
  // Enhanced first load handling with faster audio
  useEffect(() => {
    if (autoPlay && isInView && !hasStarted) {
      // Just try to unmute when ready, don't auto-play here since it's handled elsewhere
      const attemptUnmute = () => {
        if (videoRef.current && !videoRef.current.paused && !videoRef.current.seeking && !userHasToggledMute) {
          try {
            // Only unmute if video is actually playing smoothly and user hasn't manually set mute state
            if (videoRef.current.readyState >= 2) { // HAVE_CURRENT_DATA or better
              videoRef.current.muted = false;
              setIsMuted(false);
            }
          } catch (e) {
            // Keep muted if there's any issue
            videoRef.current.muted = true;
            setIsMuted(true);
          }
        }
      };

      // Wait longer for video to stabilize before unmuting
      setTimeout(attemptUnmute, 500); // Increased from 200ms to 500ms
      
      // Also try to unmute when video starts playing and is ready
      const tryUnmuteOnReady = () => {
        if (videoRef.current && !videoRef.current.paused && videoRef.current.readyState >= 3 && !userHasToggledMute) {
          attemptUnmute();
        }
      };
      
      setTimeout(tryUnmuteOnReady, 1000); // Give more time for audio to stabilize
    }
  }, [autoPlay, isInView, videoId, hasStarted, userHasToggledMute]);

  // Force stop video if it's paused from restoration
  useEffect(() => {
    if (isPausedFromRestore && videoRef.current) {
      // Aggressively stop any video that should be paused from restoration
      videoRef.current.pause();
      videoRef.current.muted = true;
      videoRef.current.currentTime = 0;
      // Don't set volume = 0, let normal audio management handle it
      setIsPlaying(false);
      
    }
  }, [isPausedFromRestore, videoId]);

  // Add user interaction detection for immediate unmute
  useEffect(() => {
    const handleUserInteraction = () => {
      if (videoRef.current && isPlaying && isMuted && !userHasToggledMute) {
        try {
          videoRef.current.muted = false;
          setIsMuted(false);
        } catch (e) {
        }
      }
    };

    // Listen for any user interaction to unmute
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(event => {
      window.addEventListener(event, handleUserInteraction, { once: true, passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleUserInteraction);
      });
    };
  }, [isPlaying, isMuted]);
  
  useEffect(() => {
    
    // Check if video URL is valid (skip for Cloudinary and Google Drive)
    let isActive = true; // Flag to prevent state updates after unmount
    
    if (!isCloudinarySource && computedVideoUrl) {
      fetch(computedVideoUrl, { method: 'HEAD' })
        .then(response => {
          if (!isActive) return;
          if (!response.ok) {
            setVideoError(`Video not available (${response.status})`);
          }
        })
        .catch(error => {
          if (!isActive) return;
          setVideoError("Failed to check video availability");
        })
        .finally(() => {
          if (!isActive) return;
          setIsLoading(false);
        });
    } else {
      // For Cloudinary and Google Drive videos, assume they're available
      setIsLoading(false);
    }
      
    return () => {
      isActive = false; // Prevent state updates after unmount
      // Cleanup - more aggressive cleanup to prevent audio issues
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.muted = true;
          videoRef.current.currentTime = 0;
          // Remove src to fully cleanup
          videoRef.current.removeAttribute('src');
          videoRef.current.load();
        } catch (error) {
          // Silent cleanup errors to avoid console spam
        }
      }
    };
  }, [videoId, computedVideoUrl, isCloudinarySource]);

  // Check if user has already liked the video
  useEffect(() => {
    if (!session?.user || !isMounted) return;
    
    let isActive = true;
    
    // Fetch like status from API
    fetch(`/api/videos/${videoId}/liked`)
      .then(res => {
        if (!isActive || !isMounted) return;
        if (res.ok) return res.json();
        throw new Error("Failed to fetch like status");
      })
      .then(data => {
        if (!isActive || !isMounted) return;
        setIsLiked(data.liked);
      })
      .catch(error => {
        if (!isActive || !isMounted) return;
      });
      
    return () => {
      isActive = false;
    };
  }, [videoId, session, isMounted]);

  const recordView = useCallback(async () => {
    try {
      const response = await fetch(`/api/videos/${videoId}/view`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        throw new Error("Failed to record view");
      }
      
      const data = await response.json();
      setViews(data.views);
    } catch (error) {
    }
  }, [videoId]);

  // Record a view when the video is played
  useEffect(() => {
    if (!hasStarted) return;
    
    if (!hasRecordedViewRef.current) {
      hasRecordedViewRef.current = true;
      recordView();
    }
  }, [hasStarted, recordView]);

  const handleStart = useCallback(() => {
    if (!videoRef.current) return;
    
    setHasStarted(true);
    setVideoError(null);
    
    
    // Try to play the video with progressive retry
    const attemptPlay = () => {
      if (!videoRef.current) return;
      
      setIsLoading(true);
      
      videoRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setVideoError(null);
          setIsLoading(false);
          retryCountRef.current = 0; // Reset retry count on success
          playAttemptRef.current = false; // Allow future play attempts
          
          // Try to unmute with proper timing after successful play
          setTimeout(() => {
            if (videoRef.current && !videoRef.current.paused && videoRef.current.readyState >= 2 && !userHasToggledMute) {
              try {
                videoRef.current.muted = false;
                setIsMuted(false);
              } catch (e) {
                // Keep muted if there's any issue
                videoRef.current.muted = true;
                setIsMuted(true);
              }
            }
          }, 300); // Increased delay for better stability
        })
        .catch((error) => {
          setIsPlaying(false);
          setIsLoading(false);
          
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            
            setTimeout(() => {
              if (videoRef.current && isInView) {
                attemptPlay();
              }
            }, 1000 * retryCountRef.current); // Exponential backoff
          } else {
            setVideoError("Unable to play video. Please check your connection and try again.");
            playAttemptRef.current = false; // Allow future play attempts
          }
        });
    };
    
    attemptPlay();
  }, [videoId, isInView, userHasToggledMute, maxRetries]);

  // Handle autoplay when in view - simplified to avoid infinite loops
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    // Only auto-play on first load when video comes into view
    if (isInView && autoPlay && !hasStarted && !playAttemptRef.current) {
      playAttemptRef.current = true;
      
      timeout = setTimeout(() => {
        if (videoRef.current && isInView && !hasStarted) {
          videoRef.current.play()
            .then(() => {
              setIsPlaying(true);
              setHasStarted(true);
              playAttemptRef.current = false;
            })
            .catch((error) => {
              setIsPlaying(false);
              playAttemptRef.current = false;
            });
        }
      }, 100);
    } else if (!isInView && videoRef.current) {
      // Pause when out of view
      videoRef.current.pause();
      setIsPlaying(false);
    }
    
    return () => {
      clearTimeout(timeout);
    };
  }, [isInView, autoPlay, hasStarted]);
  
  // Enhanced error handling with retry logic
  const handleVideoError = useCallback((e: Event) => {
    const videoElement = e.target as HTMLVideoElement;
    const error = videoElement.error;
    
    console.error(`[VideoPlayer] Video error for ${videoId}:`, {
      error,
      videoSrc: videoElement.src,
      readyState: videoElement.readyState,
      networkState: videoElement.networkState,
      errorCode: error?.code,
      errorMessage: error?.message
    });
    
    let errorMessage = "Failed to load video";
    
    if (error) {
      switch (error.code) {
        case error.MEDIA_ERR_ABORTED:
          errorMessage = "Video loading was aborted";
          break;
        case error.MEDIA_ERR_NETWORK:
          errorMessage = "Network error while loading video - check your connection";
          break;
        case error.MEDIA_ERR_DECODE:
          errorMessage = "Video decoding error - the video file may be corrupted";
          break;
        case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          // More specific error handling
          if (videoElement.src.includes('/api/videos/')) {
            // This is a streaming API URL
            if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
              errorMessage = "Development server may not be running - please start with 'npm run dev'";
            } else {
              errorMessage = "Video streaming service unavailable - server may be down";
            }
          } else if (videoElement.src.includes('localhost') && !videoElement.src.includes(':3000')) {
            errorMessage = "Development server not running - please start with 'npm run dev'";
          } else {
            errorMessage = "Video format not supported by this browser";
          }
          break;
        default:
          errorMessage = `Unknown video error (code: ${error.code})`;
      }
      
      // Add specific handling for Cloudinary private URLs
      if (isCloudinarySource && optimizedVideoUrl?.includes('/private/')) {
        errorMessage = "Private video access error - authentication may have expired";
        
        // Try to retry with a fresh streaming URL
        if (retryCount < 2) {
          setRetryCount(prev => prev + 1);
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.load();
            }
          }, 1000);
          return;
        }
      }
    }
    
    setIsLoading(false);
    setVideoError(errorMessage);
  }, [videoId, isCloudinarySource, optimizedVideoUrl, retryCount]);

  // Event listeners effect with memoized handlers
  useEffect(() => {
    if (!videoRef.current) return;
    
    const videoElement = videoRef.current;
    
    const handleLoadStart = () => {
      setIsLoading(true);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      onPlayStateChange?.(true);
      
      // Auto-unmute logic after successful play (with delay for stability)
      if (videoElement.muted && !userHasToggledMute && isInView) {
        setTimeout(async () => {
          try {
            if (videoElement && !videoElement.paused) {
              videoElement.muted = false;
              setIsMuted(false);
            }
          } catch (e) {
            // Keep muted if there's any issue
            videoElement.muted = true;
            setIsMuted(true);
          }
        }, 300); // Increased delay for better stability
      }
    };
    
    const handlePause = () => {
      setIsPlaying(false);
      onPlayStateChange?.(false);
    };

    // Handle time update for auto scroll detection
    const handleTimeUpdate = () => {
      // Update progress tracking for progress bar
      if (videoElement) {
        setCurrentTime(videoElement.currentTime);
        if (videoElement.duration) {
          setDuration(videoElement.duration);
        }
      }
      
      if (!isAutoScrollEnabled || !videoElement.duration) return;
      
      const timeRemaining = videoElement.duration - videoElement.currentTime;
      
      // Trigger auto scroll when 0.3 seconds remaining (reduced from 0.5 for smoother transition)
      if (timeRemaining <= 0.3 && timeRemaining > 0 && isPlaying) {
        onVideoEnd?.();
        // Reset video to beginning for next play
        setTimeout(() => {
          if (videoElement) {
            videoElement.currentTime = 0;
          }
        }, 100);
      }
    };
    
    // Add event listeners
    videoElement.addEventListener('error', handleVideoError);
    videoElement.addEventListener('loadstart', handleLoadStart);
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    
    return () => {
      videoElement.removeEventListener('error', handleVideoError);
      videoElement.removeEventListener('loadstart', handleLoadStart);
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [onPlayStateChange, isAutoScrollEnabled, onVideoEnd, videoId, isInView, userHasToggledMute, handleVideoError, isPlaying]);

  // Auto scroll progress checker
  useEffect(() => {
    if (!isAutoScrollEnabled || !isPlaying) return;

    const interval = setInterval(() => {
      if (videoRef.current && videoRef.current.duration) {
        const timeRemaining = videoRef.current.duration - videoRef.current.currentTime;
        
        // Trigger auto scroll when 0.3 seconds remaining (consistent with timeupdate handler)
        if (timeRemaining <= 0.3 && timeRemaining > 0) {
          onVideoEnd?.();
          // Reset video for next play
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.currentTime = 0;
            }
          }, 100);
        }
      }
    }, 300); // Check every 300ms (reduced from 500ms for better responsiveness)

    return () => clearInterval(interval);
  }, [isAutoScrollEnabled, isPlaying, onVideoEnd]);

  const togglePlay = useCallback(() => {
    
    if (!isMounted) {
      return;
    }
    
    if (!videoRef.current) {
      
      // Try to find video element directly as fallback
      const videoElement = document.querySelector(`video[data-video-id="${videoId}"]`) as HTMLVideoElement || 
                           document.querySelector('video') as HTMLVideoElement;
      if (videoElement) {
        
        // Ensure video is properly loaded before attempting play
        if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA or better
          if (videoElement.paused) {
            videoElement.play()
              .then(() => {
                setIsPlaying(true);
                setHasStarted(true);
              })
              .catch((error: any) => {
                setIsPlaying(false);
                setVideoError("Unable to play video. Please try again.");
              });
          } else {
            videoElement.pause();
            setIsPlaying(false);
          }
        } else {
          setVideoError("Video is still loading. Please wait...");
          
          // Wait for video to be ready
          const onCanPlay = () => {
            videoElement.removeEventListener('canplay', onCanPlay);
            setVideoError(null);
            if (videoElement.paused) {
              videoElement.play()
                .then(() => {
                  setIsPlaying(true);
                  setHasStarted(true);
                })
                .catch((error: any) => {
                  setVideoError("Unable to play video. Please check your connection.");
                });
            }
          };
          
          videoElement.addEventListener('canplay', onCanPlay);
          
          // Timeout fallback
          setTimeout(() => {
            videoElement.removeEventListener('canplay', onCanPlay);
            if (videoElement.readyState < 2) {
              setVideoError("Video loading timeout. Please refresh and try again.");
            }
          }, 5000);
        }
        return;
      } else {
        setVideoError("Video element not found. Please refresh the page.");
        return;
      }
    }
    
    // Normal ref-based approach
    if (videoRef.current.paused) {
      videoRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setHasStarted(true);
          setVideoError(null);
          playAttemptRef.current = false;
        })
        .catch((error: any) => {
          setIsPlaying(false);
          setVideoError("Unable to play video. Please try again.");
        });
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [isMounted, isPlaying, videoId, setIsPlaying, setHasStarted, setVideoError, playAttemptRef, videoRef]);

  const toggleMute = useCallback(() => {
    
    if (!isMounted) {
      return;
    }
    
    if (!videoRef.current) {
      const videoElement = document.querySelector(`video[data-video-id="${videoId}"]`) as HTMLVideoElement || 
                           document.querySelector('video') as HTMLVideoElement;
      if (videoElement) {
        const newMutedState = !videoElement.muted;
        videoElement.muted = newMutedState;
        setIsMuted(newMutedState);
        setUserHasToggledMute(true);
        
        // Save mute state to localStorage and dispatch event
        if (typeof window !== 'undefined') {
          localStorage.setItem('bubblegum_video_muted', newMutedState.toString());
          window.dispatchEvent(new CustomEvent('bubblegum_volume_change', {
            detail: { volume, muted: newMutedState }
          }));
        }
        
        return;
      } else {
        return;
      }
    }
    
    const newMutedState = !isMuted;
    
    try {
      // Update video element mute state
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
      setUserHasToggledMute(true); // Mark that user has manually controlled mute
      
      // Save mute state to localStorage and dispatch event
      if (typeof window !== 'undefined') {
        localStorage.setItem('bubblegum_video_muted', newMutedState.toString());
        window.dispatchEvent(new CustomEvent('bubblegum_volume_change', {
          detail: { volume, muted: newMutedState }
        }));
      }
      
      // Log for debugging
      
      // Force the state to persist and sync with native video
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.muted = newMutedState;
          // Ensure video is playing after unmute (autoplay should handle this)
          if (!newMutedState && videoRef.current.paused) {
            videoRef.current.play().catch(e => {
            });
          }
        }
      }, 50);
      
    } catch (error) {
    }
  }, [isMuted, isMounted, videoId, volume]);

  // Volume control functions
  const handleVolumeChange = useCallback((newVolume: number) => {
    if (!videoRef.current) return;
    
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
    
    // Save volume to localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('bubblegum_video_volume', clampedVolume.toString());
      
      // Dispatch custom event for same-tab real-time sync
      window.dispatchEvent(new CustomEvent('bubblegum_volume_change', {
        detail: { volume: clampedVolume, muted: isMuted }
      }));
    }
    
    try {
      videoRef.current.volume = clampedVolume;
      
      // Auto unmute if volume is set above 0
      if (clampedVolume > 0 && isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
        setUserHasToggledMute(true);
        
        // Save mute state and dispatch event
        if (typeof window !== 'undefined') {
          localStorage.setItem('bubblegum_video_muted', 'false');
          window.dispatchEvent(new CustomEvent('bubblegum_volume_change', {
            detail: { volume: clampedVolume, muted: false }
          }));
        }
      }
      
      // Auto mute if volume is set to 0
      if (clampedVolume === 0 && !isMuted) {
        videoRef.current.muted = true;
        setIsMuted(true);
        setUserHasToggledMute(true);
        
        // Save mute state and dispatch event
        if (typeof window !== 'undefined') {
          localStorage.setItem('bubblegum_video_muted', 'true');
          window.dispatchEvent(new CustomEvent('bubblegum_volume_change', {
            detail: { volume: clampedVolume, muted: true }
          }));
        }
      }
      
    } catch (error) {
    }
  }, [isMuted]);

  // Force reload volume from localStorage (for debugging and consistency)
  const reloadVolumeFromStorage = useCallback(() => {
    if (typeof window !== 'undefined') {
      const savedVolume = localStorage.getItem('bubblegum_video_volume');
      if (savedVolume) {
        const newVolume = parseFloat(savedVolume);
        setVolume(newVolume);
        
        if (videoRef.current) {
          videoRef.current.volume = newVolume;
        }
        
        return newVolume;
      }
    }
    return 1;
  }, []);

  const toggleVolumeSlider = useCallback(() => {
    setShowVolumeSlider(prev => {
      const newState = !prev;
      return newState;
    });
  }, [showVolumeSlider]);

  // Force refresh volume from localStorage when videoId changes
  useEffect(() => {
    if (typeof window !== 'undefined' && isMounted) {
      const savedVolume = localStorage.getItem('bubblegum_video_volume');
      const savedMuted = localStorage.getItem('bubblegum_video_muted');
      
      if (savedVolume) {
        const newVolume = parseFloat(savedVolume);
        
        // Force update state even if values seem similar (to handle floating point precision)
        if (Math.abs(volume - newVolume) > 0.001) {
          setVolume(newVolume);
        }
        
        // Apply to video element immediately if available
        if (videoRef.current) {
          videoRef.current.volume = newVolume;
        }
      }
      
      if (savedMuted) {
        const newMuted = savedMuted === 'true';
        if (isMuted !== newMuted) {
          setIsMuted(newMuted);
        }
        
        // Apply to video element immediately if available
        if (videoRef.current) {
          videoRef.current.muted = newMuted;
        }
      }
    }
  }, [videoId, isMounted]); // Trigger every time videoId changes

  // Listen for storage changes from other video components (real-time sync)
  useEffect(() => {
    if (!isMounted) return;
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'bubblegum_video_volume' && e.newValue) {
        const newVolume = parseFloat(e.newValue);
        setVolume(newVolume);
        
        if (videoRef.current) {
          videoRef.current.volume = newVolume;
        }
      }
      
      if (e.key === 'bubblegum_video_muted' && e.newValue !== null) {
        const newMuted = e.newValue === 'true';
        setIsMuted(newMuted);
        
        if (videoRef.current) {
          videoRef.current.muted = newMuted;
        }
      }
    };
    
    // Listen for storage changes
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events for same-tab sync
    const handleCustomVolumeChange = ((e: CustomEvent) => {
      const { volume: newVolume, muted: newMuted } = e.detail;
      
      if (newVolume !== undefined && Math.abs(volume - newVolume) > 0.001) {
        setVolume(newVolume);
        if (videoRef.current) {
          videoRef.current.volume = newVolume;
        }
      }
      
      if (newMuted !== undefined && isMuted !== newMuted) {
        setIsMuted(newMuted);
        if (videoRef.current) {
          videoRef.current.muted = newMuted;
        }
      }
    }) as EventListener;
    
    window.addEventListener('bubblegum_volume_change', handleCustomVolumeChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('bubblegum_volume_change', handleCustomVolumeChange);
    };
  }, [isMounted, volume, isMuted]);

  // Update video volume when volume state changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  // Apply saved volume when video element is loaded with force refresh
  useEffect(() => {
    if (videoRef.current && isMounted) {
      // Force check localStorage for latest volume every time
      if (typeof window !== 'undefined') {
        const savedVolume = localStorage.getItem('bubblegum_video_volume');
        const savedMuted = localStorage.getItem('bubblegum_video_muted');
        
        if (savedVolume) {
          const latestVolume = parseFloat(savedVolume);
          
          // Always apply the saved volume to be sure
          videoRef.current.volume = latestVolume;
          
          if (Math.abs(volume - latestVolume) > 0.001) {
            setVolume(latestVolume);
          }
        } else {
          // Apply current volume if no saved volume
          videoRef.current.volume = volume;
        }
        
        if (savedMuted) {
          const latestMuted = savedMuted === 'true';
          videoRef.current.muted = latestMuted;
          
          if (isMuted !== latestMuted) {
            setIsMuted(latestMuted);
          }
        } else {
          videoRef.current.muted = isMuted;
        }
      } else {
        // Apply current volume and muted state
        videoRef.current.volume = volume;
        videoRef.current.muted = isMuted;
      }
      
      if (volume === 0) {
        videoRef.current.muted = true;
        setIsMuted(true);
      }
      
    }
  }, [isMounted, videoId]); // Remove volume and isMuted from deps to avoid loops

  const handleLike = useCallback(async () => {
    if (!isMounted || !session?.user) {
      // Prompt user to log in only if mounted
      if (isMounted) {
        alert("Please log in to like videos");
      }
      return;
    }
    
    // Haptic feedback for mobile devices
    if (navigator.vibrate) {
      navigator.vibrate([50]); // Short vibration
    }
    
    // Optimistic update - update UI immediately
    const previousLiked = isLiked;
    const previousLikes = likes;
    
    // Update UI immediately for better UX
    setIsLiked(!isLiked);
    setLikes(isLiked ? previousLikes - 1 : previousLikes + 1);
    
    // Show like animation
    setShowLikeAnimation(true);
    setTimeout(() => setShowLikeAnimation(false), 800);
    
    try {
      const response = await fetch(`/api/videos/${videoId}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        // Try to get error details from response
        let errorDetail = "Unknown error";
        try {
          const errorData = await response.json();
          errorDetail = errorData.error || errorData.message || `HTTP ${response.status}`;
        } catch (e) {
          errorDetail = `HTTP ${response.status} ${response.statusText}`;
        }
        throw new Error(`Failed to like video: ${errorDetail}`);
      }
      
      const data = await response.json();
      
      // Update with actual server response
      setLikes(data.likes);
      setIsLiked(data.liked);
    } catch (error) {
      console.error("Error liking video:", error);
      
      // Revert optimistic update on error
      setIsLiked(previousLiked);
      setLikes(previousLikes);
      
      // Show error message to user
      alert("Failed to like video. Please try again.");
    }
  }, [session?.user, isLiked, likes, videoId, isMounted, setIsLiked, setLikes, setShowLikeAnimation]);

  // Handle double tap for skip/rewind
  const handleDoubleTap = useCallback((side: 'left' | 'right', event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!isMounted) return; // Prevent hydration issues
    
    const now = performance.now(); // More stable than Date.now()
    const doubleTapThreshold = 300; // milliseconds
    
    if (lastTap && lastTap.side === side && (now - lastTap.time) < doubleTapThreshold) {
      // Double tap detected - skip/rewind
      if (!videoRef.current) return;
      
      const skipAmount = 2; // seconds
      const currentTime = videoRef.current.currentTime;
      
      if (side === 'right') {
        // Skip forward
        videoRef.current.currentTime = Math.min(currentTime + skipAmount, videoRef.current.duration);
      } else {
        // Rewind
        videoRef.current.currentTime = Math.max(currentTime - skipAmount, 0);
      }
      
      // Show animation
      setShowSkipAnimation(side);
      setTimeout(() => setShowSkipAnimation(null), 800);
      
      // Reset last tap
      setLastTap(null);
    } else {
      // First tap - store for potential double tap
      setLastTap({ time: now, side });
      
      // Set timeout to handle single tap action if no second tap comes
      setTimeout(() => {
        setLastTap(prev => {
          if (prev && prev.time === now && (performance.now() - prev.time) >= doubleTapThreshold) {
            // Single tap detected - trigger play/pause
            togglePlay();
            return null;
          }
          return prev;
        });
      }, doubleTapThreshold);
    }
  }, [lastTap, isMounted, togglePlay]);

  // Format view count
  const formatCount = useCallback((count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    } else {
      return count.toString();
    }
  }, []);

  // Handle client-side mounting to prevent hydration issues
  useEffect(() => {
    setIsMounted(true);
    
    // Force refresh volume from localStorage when videoId changes and component mounts
    if (typeof window !== 'undefined') {
      const savedVolume = localStorage.getItem('bubblegum_video_volume');
      const savedMuted = localStorage.getItem('bubblegum_video_muted');
      
      if (savedVolume) {
        const latestVolume = parseFloat(savedVolume);
        if (Math.abs(volume - latestVolume) > 0.001) {
          setVolume(latestVolume);
        }
      }
      
      if (savedMuted) {
        const latestMuted = savedMuted === 'true';
        if (isMuted !== latestMuted) {
          setIsMuted(latestMuted);
        }
      }
    }
    
  }, [videoId]); // Trigger when videoId changes to force refresh

  // Listen for auto scroll state changes from parent component
  useEffect(() => {
    if (!isMounted) return;
    
    const handleAutoScrollStateChange = () => {
      // Update local state from localStorage
      const autoScrollState = localStorage.getItem('bubblegum_auto_scroll_enabled') === 'true';
      setLocalAutoScrollEnabled(autoScrollState);
    };
    
    // Listen for auto scroll changes
    window.addEventListener('toggleAutoScroll', handleAutoScrollStateChange);
    
    // Initialize state on mount
    handleAutoScrollStateChange();
    
    return () => {
      window.removeEventListener('toggleAutoScroll', handleAutoScrollStateChange);
    };
  }, [isMounted]);

  // Close volume slider when clicking outside
  useEffect(() => {
    if (!showVolumeSlider || !isMounted) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.volume-control-area')) {
        setShowVolumeSlider(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showVolumeSlider, isMounted]);

  // Add keyboard support for spacebar pause/play
  useEffect(() => {
    if (!isMounted) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMounted, togglePlay]);

  // Force reload volume when mounting new video
  useEffect(() => {
    if (typeof window !== 'undefined' && isMounted) {
      const savedVolume = localStorage.getItem('bubblegum_video_volume');
      if (savedVolume) {
        const newVolume = parseFloat(savedVolume);
        
        // Update state if different from current
        if (Math.abs(volume - newVolume) > 0.01) {
          setVolume(newVolume);
        }
        
        // Apply to video element immediately
        if (videoRef.current) {
          videoRef.current.volume = newVolume;
        }
      }
    }
  }, [videoId, isMounted]); // Trigger when video changes

  // Helper functions for progress bar
  const getProgressPercentage = (): number => {
    if (duration === 0) return 0;
    return (currentTime / duration) * 100;
  };
  
  const handleSeek = (percentage: number) => {
    if (!videoRef.current || !duration) return;
    
    const newTime = (percentage / 100) * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Reset hide background state when video changes
  useEffect(() => {
    setLocalIsBackgroundHidden(false);
  }, [videoId]);

  // Callback untuk memberitahu parent component tentang perubahan hide background
  useEffect(() => {
    if (onBackgroundHiddenChange) {
      onBackgroundHiddenChange(localIsBackgroundHidden);
    }
  }, [localIsBackgroundHidden, onBackgroundHiddenChange]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Prevent hydration mismatch by not rendering interactive elements on server */}
      {!isMounted ? (
        // Server-side placeholder
        <div className="relative w-full h-full bg-black">
          {computedThumbnail && (
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-50 blur-sm"
              style={{ backgroundImage: `url(${computedThumbnail})` }}
            />
          )}
          <video
            ref={setVideoRef}
            data-video-id={videoId}
            src={computedVideoUrl || undefined}
            poster={computedThumbnail}
            preload="none"
            className="absolute top-0 left-0 w-full object-contain z-10"
            style={{ 
              objectPosition: 'center top',
              height: 'clamp(500px, calc(100vh - 100px), calc(100vh - 80px))',
              maxHeight: '100vh'
            }}
          />
          {/* Simple play button for SSR */}
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="bg-black/30 rounded-full p-4">
              <FaPlay className="text-white text-3xl" />
            </div>
          </div>
        </div>
      ) : (
        // Client-side full functionality
        <div className="relative w-full h-full bg-black">
          {/* Background placeholder */}
          {computedThumbnail && (
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-50 blur-sm"
              style={{ backgroundImage: `url(${computedThumbnail})` }}
            />
          )}
          
          {/* Video Element */}
          <video
            ref={setVideoRef}
            data-video-id={videoId}
            src={computedVideoUrl || undefined}
            poster={computedThumbnail}
            preload="none"
            className="absolute top-0 left-0 w-full object-contain z-10"
            style={{ 
              objectPosition: 'center top',
              height: 'clamp(500px, calc(100vh - 100px), calc(100vh - 80px))',
              maxHeight: '100vh'
            }}
          />

          {/* Touch interaction areas - IMPORTANT: Lower z-index, exclude bottom for UI elements */}
          <div className="absolute inset-0 z-20 flex pb-16">
            {/* Left side - Rewind */}
            <div 
              className="w-1/4 h-full"
              onClick={(e) => {
                e.stopPropagation();
                handleDoubleTap('left', e);
              }}
            />
            {/* Center - Play/Pause with proper click handling */}
            <div 
              className="w-1/2 h-full flex items-center justify-center cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (!isMounted) return;
                
                // Add small delay to ensure ref is available
                setTimeout(() => {
                  togglePlay();
                }, 50);
              }}
            />
            {/* Right side - Skip */}
            <div 
              className="w-1/4 h-full"
              onClick={(e) => {
                e.stopPropagation();
                handleDoubleTap('right', e);
              }}
            />
          </div>

          {/* Visual feedback elements - Medium z-index */}
          {/* Skip animation overlays */}
          <AnimatePresence>
            {showSkipAnimation && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.4 }}
                className={`absolute inset-0 flex items-center z-25 pointer-events-none ${
                  showSkipAnimation === 'left' ? 'justify-start pl-12' : 'justify-end pr-12'
                }`}
              >
                <div className="bg-black/60 backdrop-blur-sm rounded-full p-6 flex items-center space-x-2">
                  {showSkipAnimation === 'left' ? (
                    <>
                      <FaBackward className="text-white text-2xl" />
                      <span className="text-white font-bold text-lg">-2s</span>
                    </>
                  ) : (
                    <>
                      <span className="text-white font-bold text-lg">+2s</span>
                      <FaForward className="text-white text-2xl" />
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Play button overlay (center) */}
          <AnimatePresence>
            {!isPlaying && !isLoading && !videoError && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex items-center justify-center z-25 pointer-events-none"
              >
                <div className="bg-black/50 rounded-full p-6 backdrop-blur-sm">
                  <FaPlay className="text-white text-4xl" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pause indicator for visual feedback */}
          <AnimatePresence>
            {isPlaying && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0 }}
                whileTap={{ opacity: 1, scale: 1.1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="absolute inset-0 flex items-center justify-center z-25 pointer-events-none"
              >
                <div className="bg-black/50 rounded-full p-4 backdrop-blur-sm">
                  <FaPause className="text-white text-2xl" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading/Error overlays - Higher z-index */}
          <AnimatePresence>
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 z-30"
              >
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
                  <p className="text-white mt-4 text-sm">Loading video...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <AnimatePresence>
            {videoError && !isLoading && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80 z-30 p-4"
              >
                <div className="bg-gray-900 p-6 rounded-xl max-w-sm w-full text-center">
                  <div className="text-red-400 text-center mb-4">{videoError}</div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setVideoError(null);
                      setRetryCount(0);
                      setIsLoading(true);
                      
                      // Reload the video element
                      if (videoRef.current) {
                        videoRef.current.load();
                      }
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 rounded-lg text-white hover:from-pink-600 hover:to-purple-600 transition-all shadow-md"
                  >
                    Retry
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Like animation overlays */}
          <AnimatePresence>
            {showLikeAnimation && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ 
                  opacity: [0, 1, 1, 0], 
                  scale: [0.5, 1.2, 1.2, 1.5],
                  y: [0, -20, -40, -60]
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="absolute right-9 bottom-24 z-30 pointer-events-none"
              >
                <div className="flex items-center justify-center">
                  <FaHeart className={`text-pink-500 text-4xl drop-shadow-lg ${
                    isLiked ? 'animate-pulse' : ''
                  }`} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Enhanced Sound toggle button with Volume Slider */}
          <div className="absolute top-4 right-3 z-50 volume-control-area">
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                toggleVolumeSlider();
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="bg-black/40 backdrop-blur-sm hover:bg-black/60 rounded-full p-3 transition-all border border-white/20 cursor-pointer"
              aria-label="Volume controls"
            >
              {isMuted || volume === 0 ? (
                <FaVolumeMute className="text-white text-lg" />
              ) : volume < 0.5 ? (
                <FaVolumeDown className="text-white text-lg" />
              ) : (
                <FaVolumeUp className="text-white text-lg" />
              )}
            </motion.button>

            {/* Volume Slider Panel */}
            <AnimatePresence>
              {showVolumeSlider && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-16 right-0 bg-black/80 backdrop-blur-md rounded-xl p-4 border border-white/20 min-w-[200px]"
                >
                  <div className="space-y-3">
                    <div className="text-white text-sm font-semibold text-center">
                      Volume Control
                    </div>
                    
                    {/* Volume Slider */}
                    <div className="flex items-center space-x-3">
                      <FaVolumeMute className="text-white/70 text-sm flex-shrink-0" />
                      
                      <div className="flex-1 relative">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={volume}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleVolumeChange(parseFloat(e.target.value));
                          }}
                          className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer volume-slider"
                          style={{
                            background: `linear-gradient(to right, #ec4899 0%, #ec4899 ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%, rgba(255,255,255,0.2) 100%)`
                          }}
                        />
                        <style jsx>{`
                          .volume-slider::-webkit-slider-thumb {
                            appearance: none;
                            width: 16px;
                            height: 16px;
                            border-radius: 50%;
                            background: #ec4899;
                            cursor: pointer;
                            border: 2px solid white;
                            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
                            transition: all 0.2s ease;
                          }
                          .volume-slider::-webkit-slider-thumb:hover {
                            transform: scale(1.2);
                            box-shadow: 0 4px 12px rgba(236, 72, 153, 0.4);
                          }
                          .volume-slider::-moz-range-thumb {
                            width: 16px;
                            height: 16px;
                            border-radius: 50%;
                            background: #ec4899;
                            cursor: pointer;
                            border: 2px solid white;
                            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
                            transition: all 0.2s ease;
                          }
                          .volume-slider::-moz-range-thumb:hover {
                            transform: scale(1.2);
                            box-shadow: 0 4px 12px rgba(236, 72, 153, 0.4);
                          }
                        `}</style>
                      </div>
                      
                      <FaVolumeUp className="text-white/70 text-sm flex-shrink-0" />
                    </div>
                    
                    {/* Volume Percentage */}
                    <div className="text-center">
                      <span className="text-white/90 text-xs font-medium">
                        {Math.round(volume * 100)}%
                      </span>
                    </div>
                    
                    {/* Quick Volume Buttons */}
                    <div className="flex justify-center space-x-2">
                      {[0, 0.25, 0.5, 0.75, 1].map((vol) => (
                        <motion.button
                          key={vol}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVolumeChange(vol);
                          }}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            Math.abs(volume - vol) < 0.05
                              ? 'bg-pink-500 text-white'
                              : 'bg-white/20 text-white/70 hover:bg-white/30'
                          }`}
                        >
                          {vol === 0 ? 'Mute' : `${Math.round(vol * 100)}%`}
                        </motion.button>
                      ))}
                    </div>
                    
                    {/* Mute Toggle */}
                    <div className="border-t border-white/20 pt-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMute();
                        }}
                        className="w-full py-2 px-3 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                      >
                        {isMuted ? <FaVolumeUp /> : <FaVolumeMute />}
                        <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Caption toggle button - HIGHEST z-index */}
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              setShowCaptionControls(!showCaptionControls);
            }}
            whileHover={{ scale: 1.1 }}
            className="absolute top-4 left-3 z-50 bg-black/40 backdrop-blur-sm hover:bg-black/60 rounded-full p-3 transition-all border border-white/20 cursor-pointer"
            aria-label="Caption controls"
          >
            <FaEllipsisH className="text-white text-lg" />
          </motion.button>

          {/* Caption controls panel - HIGHEST z-index */}
          <AnimatePresence>
            {showCaptionControls && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                className="absolute top-4 left-16 z-50 bg-black/80 backdrop-blur-md rounded-xl p-4 border border-white/20"
              >
                <div className="text-white text-sm space-y-3">
                  <div className="font-semibold mb-2">Video Settings</div>
                  
                  {/* Auto Scroll Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FaArrowDown className="text-pink-400 text-xs" />
                      <span className="text-xs">Auto Scroll</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Toggle local state immediately
                        const newState = !localAutoScrollEnabled;
                        setLocalAutoScrollEnabled(newState);
                        
                        // Update localStorage
                        localStorage.setItem('bubblegum_auto_scroll_enabled', newState.toString());
                        
                        // Dispatch global event
                        window.dispatchEvent(new CustomEvent('toggleAutoScroll'));
                        
                        // Show notification
                        setShowAutoScrollNotification(true);
                        setTimeout(() => setShowAutoScrollNotification(false), 2000);
                        
                        // Close caption controls after toggle
                        setTimeout(() => setShowCaptionControls(false), 500);
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        localAutoScrollEnabled ? 'bg-pink-500' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          localAutoScrollEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  
                  {localAutoScrollEnabled && (
                    <div className="text-xs text-pink-400 bg-pink-500/10 rounded p-2">
                      <FaRedo className="inline mr-1" />
                      Auto scroll to next video when current ends
                    </div>
                  )}
                  
                  {/* Hide Background Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FaEyeSlash className="text-gray-400 text-xs" />
                      <span className="text-xs">Hide Background</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Toggle background visibility
                        const newState = !localIsBackgroundHidden;
                        setLocalIsBackgroundHidden(newState);
                        
                        // Close caption controls after toggle
                        setTimeout(() => setShowCaptionControls(false), 500);
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        localIsBackgroundHidden ? 'bg-gray-500' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          localIsBackgroundHidden ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  
                  {localIsBackgroundHidden && (
                    <div className="text-xs text-gray-400 bg-gray-500/10 rounded p-2">
                      <FaEyeSlash className="inline mr-1" />
                      Background blur is hidden for cleaner view
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Enhanced Bottom Video Info Section */}
          {!localIsBackgroundHidden ? (
            <motion.div 
              className="absolute left-0 right-0 bottom-12 z-30 pointer-events-none"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
            >
              {/* Gradient overlay for better text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
              
              <div className="relative px-4 py-3 space-y-2">
                {/* Creator Profile Section */}
                <motion.div 
                  className="flex items-center space-x-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 p-0.5">
                      <div className="w-full h-full rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center">
                        <FaUser className="text-white text-lg" />
                      </div>
                    </div>
                    {/* Online indicator */}
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-black/50" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-white text-base font-bold drop-shadow-lg">
                        @bubblegum_creator
                      </h4>
                      {/* Verified badge */}
                      <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    
                    <div className="flex items-center mt-1 space-x-4">
                      <div className="flex items-center space-x-1">
                        <FaEye className="text-white/70 text-xs" />
                        <span className="text-white/90 text-sm font-medium">
                          {formatCount(views)} views
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Like button - restored for creator profile section */}
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLike();
                    }}
                    className="w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm border border-white/30 transition-all pointer-events-auto flex items-center justify-center relative z-50"
                  >
                    <FaHeart className={`text-lg transition-colors duration-300 ${
                      isLiked ? 'text-pink-500' : 'text-white'
                    }`} />
                  </motion.button>
                </motion.div>
                
                {/* Video Title and Description */}
                <motion.div 
                  className="space-y-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                >
                  <h3 className="text-white text-lg font-bold leading-tight drop-shadow-lg pr-16">
                    {title}
                  </h3>
                  
                  {/* Enhanced Hashtags */}
                  <div className="flex flex-wrap gap-2">
                    {['#bubblegum', '#viral', '#trending', '#fyp'].map((tag, index) => (
                      <motion.span
                        key={tag}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 + index * 0.1, duration: 0.3 }}
                        className="inline-flex items-center px-2 py-1 bg-pink-500/20 hover:bg-pink-500/30 rounded-full backdrop-blur-sm border border-pink-400/30 transition-colors cursor-pointer pointer-events-auto"
                      >
                        <span className="text-pink-300 text-sm font-medium">{tag}</span>
                      </motion.span>
                    ))}
                  </div>
                </motion.div>
                
                {/* Enhanced Music Info with Better Animation */}
                <motion.div 
                  className="flex items-center space-x-3 py-1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                >
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
                      <FaMusic className="text-white text-sm animate-pulse" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="relative h-5">
                      <motion.div
                        className="absolute whitespace-nowrap flex items-center h-full"
                        animate={{
                          x: [0, -300, 0]
                        }}
                        transition={{
                          duration: 12,
                          repeat: Infinity,
                          ease: "linear",
                          repeatDelay: 2
                        }}
                      >
                        <span className="text-white/90 text-sm font-medium mr-8">
                          ♪ Original Sound - Bubblegum 
                        </span>
                        <span className="text-pink-300 text-sm mr-8">
                          🔥 Trending Music 
                        </span>
                        <span className="text-purple-300 text-sm mr-8">
                          ✨ Hot Audio
                        </span>
                        <span className="text-blue-300 text-sm mr-8">
                          🎵 Popular Beat
                        </span>
                      </motion.div>
                    </div>
                  </div>
                  
                  {/* Music controls */}
                  <div className="flex items-center space-x-2">
                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur-sm flex items-center justify-center transition-all pointer-events-auto"
                    >
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816L4.975 14H2a1 1 0 01-1-1V7a1 1 0 011-1h2.975l3.408-2.816z" clipRule="evenodd" />
                        <path d="M14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.983 5.983 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.984 3.984 0 00-1.172-2.828 1 1 0 010-1.415z" />
                      </svg>
                    </motion.button>
                    
                    <div className="flex items-center space-x-1">
                      <span className="text-white/70 text-xs font-medium">
                        {formatCount(likes)} ❤️
                      </span>
                    </div>
                  </div>
                </motion.div>
                
                {/* TikTok-style Progress Bar - positioned below music marquee */}
                {duration > 0 && (
                  <motion.div
                    className="mt-1 px-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8, duration: 0.5 }}
                  >
                    {/* Background track */}
                    <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                      {/* Progress fill */}
                      <motion.div
                        className="h-full bg-gradient-to-r from-pink-500 to-red-500 rounded-full"
                        style={{ width: `${getProgressPercentage()}%` }}
                        transition={{ duration: isDragging ? 0 : 0.1 }}
                      />
                    </div>
                    
                    {/* Interactive seeking area (invisible but functional) */}
                    <div
                      className="absolute inset-0 -top-2 -bottom-2 cursor-pointer pointer-events-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const percentage = ((e.clientX - rect.left) / rect.width) * 100;
                        handleSeek(Math.max(0, Math.min(100, percentage)));
                      }}
                    />
                  </motion.div>
                )}

                {/* REMOVED-Video-Stats - REMOVED */}
              </div>
            </motion.div>
          ) : (
            /* Minimal UI when background is hidden */
            <motion.div 
              className="absolute left-0 right-0 bottom-20 z-30 pointer-events-none"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="px-4">
                {/* Close Button (X) only */}
                <div className="flex justify-center">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocalIsBackgroundHidden(false);
                    }}
                    className="w-8 h-8 bg-black/60 backdrop-blur-sm hover:bg-black/80 rounded-full border border-white/20 transition-all pointer-events-auto flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Play/Pause Button in bottom right corner when background is hidden */}
          {localIsBackgroundHidden && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="absolute bottom-20 right-4 z-50 w-12 h-12 bg-black/60 backdrop-blur-sm hover:bg-black/80 rounded-full border border-white/20 transition-all pointer-events-auto flex items-center justify-center"
            >
              {isPlaying ? (
                <FaPause className="text-white text-lg" />
              ) : (
                <FaPlay className="text-white text-lg ml-1" />
              )}
            </motion.button>
          )}

          {/* Notification overlays */}
          <AnimatePresence>
            {isPausedFromRestore && !isPlaying && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 bg-black/80 backdrop-blur-md rounded-xl p-4 border border-white/20"
              >
                <div className="flex flex-col items-center space-y-2 text-white text-center">
                  <FaPlay className="text-pink-400 text-2xl" />
                  <span className="text-sm font-medium">Tap to continue</span>
                  <span className="text-xs text-white/70">Video paused from navigation</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showAutoScrollNotification && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                className="absolute top-16 left-1/2 transform -translate-x-1/2 z-40 bg-black/80 backdrop-blur-md rounded-lg p-3 border border-white/20"
              >
                <div className="flex items-center space-x-2 text-white text-sm">
                  {localAutoScrollEnabled ? (
                    <>
                      <FaRedo className="text-pink-400" />
                      <span className="font-medium">Auto Scroll ON</span>
                    </>
                  ) : (
                    <>
                      <FaArrowDown className="text-gray-400" />
                      <span className="font-medium">Auto Scroll OFF</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-white/70 mt-1 text-center">
                  {localAutoScrollEnabled 
                    ? "Videos will auto-advance when they end"
                    : "Manual navigation only"
                  }
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
});

VideoPlayer.displayName = "VideoPlayer";

export default VideoPlayer; 
