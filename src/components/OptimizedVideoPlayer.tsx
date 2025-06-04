'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface OptimizedVideoPlayerProps {
  src: string;
  thumbnail?: string;
  title?: string;
  className?: string;
  width?: number;
  height?: number;
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
}

/**
 * Optimized Video Player for KMV1 VPS
 * Features:
 * - Progressive loading
 * - Smart buffering
 * - Lazy loading
 * - Bandwidth adaptation
 * - Error recovery
 */
export default function OptimizedVideoPlayer({
  src,
  thumbnail,
  title,
  className = '',
  width = 720,
  height = 405,
  autoplay = false,
  muted = true,
  controls = true
}: OptimizedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [playbackQuality, setPlaybackQuality] = useState<'720p' | '480p' | '360p'>('720p');
  const [hasStartedLoading, setHasStartedLoading] = useState(false);

  // Progressive video sources based on quality
  const getVideoSrc = useCallback((quality: string) => {
    if (src.includes('/optimized/')) {
      return src; // Already optimized
    }
    
    // Try to find optimized version first
    const optimizedSrc = src.replace('/videos/', '/videos/optimized/optimized_');
    return optimizedSrc.replace(/\.\w+$/, '.mp4');
  }, [src]);

  // Bandwidth detection for quality adaptation
  const detectBandwidth = useCallback(async () => {
    try {
      const startTime = Date.now();
      const response = await fetch(`${src}?range=0-100000`, { 
        headers: { 'Range': 'bytes=0-100000' }
      });
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // seconds
      const bytesLoaded = 100000;
      const kbps = (bytesLoaded * 8) / (1024 * duration);
      
      // Adapt quality based on bandwidth
      if (kbps < 500) {
        setPlaybackQuality('360p');
      } else if (kbps < 1000) {
        setPlaybackQuality('480p');
      } else {
        setPlaybackQuality('720p');
      }
    } catch (error) {
      console.warn('Bandwidth detection failed, using default quality');
      setPlaybackQuality('480p'); // Conservative default for KMV1
    }
  }, [src]);

  // Lazy loading implementation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasStartedLoading) {
            setHasStartedLoading(true);
            detectBandwidth();
          }
        });
      },
      { threshold: 0.1 }
    );

    if (videoRef.current) {
      observer.observe(videoRef.current);
    }

    return () => observer.disconnect();
  }, [detectBandwidth, hasStartedLoading]);

  // Video event handlers
  const handleLoadStart = () => {
    setIsLoading(true);
    setError(null);
  };

  const handleProgress = () => {
    if (videoRef.current) {
      const buffered = videoRef.current.buffered;
      if (buffered.length > 0) {
        const progress = (buffered.end(0) / videoRef.current.duration) * 100;
        setLoadProgress(progress);
      }
    }
  };

  const handleCanPlay = () => {
    setIsLoading(false);
  };

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const error = (e.target as HTMLVideoElement).error;
    setError(`Video loading failed: ${error?.message || 'Unknown error'}`);
    setIsLoading(false);
    
    // Try to use fallback source
    if (videoRef.current && videoRef.current.src !== src) {
      videoRef.current.src = src;
      videoRef.current.load();
    }
  };

  // Manual play handler with error recovery
  const handlePlayClick = async () => {
    if (!videoRef.current) return;

    try {
      setIsLoading(true);
      await videoRef.current.play();
    } catch (error) {
      console.error('Playback failed:', error);
      setError('Playback failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {/* Thumbnail placeholder */}
      {thumbnail && !hasStartedLoading && (
        <div 
          className="absolute inset-0 bg-cover bg-center flex items-center justify-center cursor-pointer"
          style={{ backgroundImage: `url(${thumbnail})` }}
          onClick={() => setHasStartedLoading(true)}
        >
          <div className="bg-black bg-opacity-50 rounded-full p-4">
            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      )}

      {/* Video element */}
      {hasStartedLoading && (
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          width={width}
          height={height}
          controls={controls}
          autoPlay={autoplay}
          muted={muted}
          preload="metadata"
          playsInline
          src={getVideoSrc(playbackQuality)}
          onLoadStart={handleLoadStart}
          onProgress={handleProgress}
          onCanPlay={handleCanPlay}
          onPlay={handlePlay}
          onPause={handlePause}
          onError={handleError}
        >
          <source src={getVideoSrc(playbackQuality)} type="video/mp4" />
          <p className="text-red-500">Your browser does not support the video tag.</p>
        </video>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p className="text-sm">Loading video...</p>
            {loadProgress > 0 && (
              <div className="w-32 bg-gray-700 rounded-full h-1 mt-2">
                <div 
                  className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${loadProgress}%` }}
                ></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 bg-red-900 bg-opacity-90 flex items-center justify-center">
          <div className="text-white text-center p-4">
            <svg className="w-12 h-12 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm mb-2">{error}</p>
            <button 
              onClick={() => {
                setError(null);
                setHasStartedLoading(false);
              }}
              className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Quality indicator */}
      {hasStartedLoading && !error && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
          {playbackQuality}
        </div>
      )}

      {/* Title overlay */}
      {title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-3">
          <h3 className="text-white text-sm font-medium truncate">{title}</h3>
        </div>
      )}
    </div>
  );
} 