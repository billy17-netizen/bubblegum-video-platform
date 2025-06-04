'use client';

import { useEffect, useRef, useState } from 'react';
import { getSafeVideoUrlWithFallback, VideoData } from '@/lib/videoService.client';

interface BunnyVideoPlayerProps {
  video: VideoData;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
  muted?: boolean;
  loop?: boolean;
  poster?: string;
}

export default function BunnyVideoPlayer({
  video,
  className = '',
  autoPlay = false,
  controls = true,
  muted = false,
  loop = false,
  poster
}: BunnyVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const { primary, fallback } = getSafeVideoUrlWithFallback(video);
    
    console.log('[BunnyVideoPlayer] Video URLs:', { primary, fallback });
    
    // Start with primary URL
    setCurrentSrc(primary);
    setError(null);
    setIsUsingFallback(false);
    setRetryCount(0);
  }, [video]);

  const handleVideoError = (e: any) => {
    console.log('[BunnyVideoPlayer] Video error:', e.target?.error);
    console.log('[BunnyVideoPlayer] Failed URL:', currentSrc);
    
    const { fallback } = getSafeVideoUrlWithFallback(video);
    
    if (fallback && !isUsingFallback && retryCount < 1) {
      console.log('[BunnyVideoPlayer] Switching to HLS fallback:', fallback);
      setCurrentSrc(fallback);
      setIsUsingFallback(true);
      setRetryCount(prev => prev + 1);
      setError(null);
    } else {
      console.error('[BunnyVideoPlayer] All video sources failed');
      setError('Video is currently processing or failed to load. Please try again later.');
    }
  };

  const handleVideoLoad = () => {
    console.log('[BunnyVideoPlayer] Video loaded successfully:', currentSrc);
    setError(null);
  };

  const handleRetry = () => {
    const { primary } = getSafeVideoUrlWithFallback(video);
    setCurrentSrc(primary);
    setError(null);
    setIsUsingFallback(false);
    setRetryCount(0);
  };

  if (error) {
    return (
      <div className={`bg-gray-900 text-white flex items-center justify-center min-h-[300px] ${className}`}>
        <div className="text-center p-8">
          <div className="text-6xl mb-4">🎬</div>
          <div className="text-lg font-semibold mb-2">Video Processing</div>
          <div className="text-sm text-gray-300 mb-4">{error}</div>
          {video.bunnyVideoId && (
            <div className="text-xs text-gray-400 mb-4">
              Video ID: {video.bunnyVideoId}
            </div>
          )}
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <video
        ref={videoRef}
        src={currentSrc}
        poster={poster}
        controls={controls}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        onError={handleVideoError}
        onLoadStart={handleVideoLoad}
        onCanPlay={() => console.log('[BunnyVideoPlayer] Video can play')}
        className="w-full h-full object-cover"
        preload="metadata"
      >
        <source src={currentSrc} type={isUsingFallback ? "application/x-mpegURL" : "video/mp4"} />
        Your browser does not support the video tag.
      </video>
      
      {isUsingFallback && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
          HLS Stream
        </div>
      )}
      
      {video.bunnyVideoId && (
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
          Bunny CDN
        </div>
      )}
    </div>
  );
} 