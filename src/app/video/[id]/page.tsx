"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { FaArrowLeft, FaHeart, FaEye, FaShare, FaUser, FaCalendar, FaVideoSlash, FaSpinner } from "react-icons/fa";
import VideoPlayer from "@/components/VideoPlayer";
import { getVideoUrl, getThumbnailUrl } from "@/lib/videoService.client";

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
  bunnyVideoId?: string;
  bunnyStreamUrl?: string;
  bunnyThumbnailUrl?: string;
  storageType?: 'local' | 'cloudinary' | 'bunny' | 'googledrive';
  bestVideoUrl?: string;
  bestThumbnailUrl?: string;
  createdAt: string;
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

export default function VideoPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [video, setVideo] = useState<VideoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [error, setError] = useState("");
  const viewRecorded = useRef(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to get MP4 video URL (filter out HLS)
  const getMP4VideoUrl = (video: VideoData) => {
    // Priority order: try to get MP4 alternatives
    const possibleUrls = [
      video.bestVideoUrl,
      video.cloudinaryUrl,
      video.googleDriveVideoUrl,
      video.filePath
    ].filter(Boolean);

    // Filter out HLS URLs and convert to MP4
    for (const url of possibleUrls) {
      if (url && !url.includes('.m3u8') && !url.includes('playlist')) {
        return url;
      }
      
      // Convert Bunny.net HLS to MP4
      if (url && url.includes('.m3u8')) {
        const mp4Url = url.replace('/playlist.m3u8', '/play_720p.mp4');
        return mp4Url;
      }
    }

    // Try to get first valid source from getVideoSources
    const sources = getVideoSources(video);
    return sources.length > 0 ? sources[0] : null;
  };

  // Helper function to get multiple MP4 sources for fallback
  const getVideoSources = (video: VideoData) => {
    const baseUrl = video.bestVideoUrl || video.cloudinaryUrl;
    const sources = [];
    
    // If it's a Bunny.net URL, add multiple quality options
    if (baseUrl && baseUrl.includes('b-cdn.net')) {
      const baseUrlWithoutExtension = baseUrl.replace('/playlist.m3u8', '');
      sources.push(
        `${baseUrlWithoutExtension}/play_720p.mp4`,
        `${baseUrlWithoutExtension}/play_480p.mp4`,
        `${baseUrlWithoutExtension}/play_360p.mp4`
      );
    }
    
    // Add other possible URLs (only if they don't contain HLS)
    if (video.cloudinaryUrl && !video.cloudinaryUrl.includes('.m3u8')) {
      sources.push(video.cloudinaryUrl);
    }
    
    if (video.googleDriveVideoUrl) {
      sources.push(video.googleDriveVideoUrl);
    }
    
    if (video.filePath) {
      sources.push(video.filePath);
    }
    
    // Remove duplicates and filter out HLS URLs
    const uniqueSources = [...new Set(sources)].filter(url => 
      url && !url.includes('.m3u8') && !url.includes('playlist')
    );
    
    // Only return sources if we have valid URLs, don't add streaming API fallback
    return uniqueSources.length > 0 ? uniqueSources : [];
  };

  // Helper function to format date safely
  const formatDate = (dateString: string | object | null | undefined) => {
    try {
      // Handle various input types
      if (!dateString || 
          (typeof dateString === 'object' && Object.keys(dateString).length === 0) ||
          dateString === null || 
          dateString === undefined) {
        return 'Recent';
      }

      // Convert to string if it's an object
      let dateStr = dateString;
      if (typeof dateString === 'object') {
        // Try to extract date from object properties
        const obj = dateString as any;
        dateStr = obj.toISOString?.() || obj.toString?.() || JSON.stringify(dateString);
      }

      // Handle ISO string or regular date string
      const date = new Date(dateStr as string);
      if (isNaN(date.getTime())) {
        // If parsing failed, try current date as fallback
        console.log('[Date] Using current date as fallback for:', dateString);
        return new Date(); // Use current date as fallback
      }
      return date;
    } catch (error) {
      console.log('[Date] Error parsing date:', dateString, error);
      return new Date(); // Use current date as fallback
    }
  };

  const getShortDate = (dateString: string | object | null | undefined) => {
    const date = formatDate(dateString);
    if (date === 'Recent') return 'Recent';
    
    try {
      return (date as Date).toLocaleDateString('en-US', { 
        day: 'numeric', 
        month: 'short' 
      });
    } catch {
      try {
        return (date as Date).toDateString().split(' ').slice(1, 3).join(' ');
      } catch {
        return 'Recent';
      }
    }
  };

  const getLongDate = (dateString: string | object | null | undefined) => {
    const date = formatDate(dateString);
    if (date === 'Recent') return 'Recently';
    
    try {
      return (date as Date).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      try {
        return (date as Date).toDateString();
      } catch {
        return 'Recently';
      }
    }
  };

  // Check authentication and redirect if not logged in
  useEffect(() => {
    if (status === "loading") return;
    
    if (status === "unauthenticated") {
      router.push("/login");
    } else {
      setAuthChecked(true);
    }
  }, [status, router]);

  useEffect(() => {
    // Only fetch video data after authentication is confirmed
    if (!authChecked) return;
    
    const fetchVideo = async () => {
      setIsLoading(true);
      setError(""); // Clear previous errors
      
      try {
        console.log(`[VideoDetail] Fetching video with ID: ${id}`);
        const response = await fetch(`/api/videos/${id}`);
        
        console.log(`[VideoDetail] API Response status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
          // Get error details from response
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          let errorDetails = null;
          
          try {
            const responseText = await response.text();
            console.log(`[VideoDetail] Raw response text:`, responseText);
            
            if (responseText.trim()) {
              try {
                errorDetails = JSON.parse(responseText);
                errorMessage = errorDetails.error || errorMessage;
                console.error(`[VideoDetail] API Error:`, errorDetails);
              } catch (jsonError) {
                console.error(`[VideoDetail] JSON parse error:`, jsonError);
                console.error(`[VideoDetail] Response was not valid JSON:`, responseText);
                errorMessage = responseText || errorMessage;
              }
            } else {
              console.error(`[VideoDetail] Empty response body`);
              errorMessage = `Empty response from server (${response.status})`;
            }
          } catch (textError) {
            console.error(`[VideoDetail] Could not read response:`, textError);
            errorMessage = `Could not read server response (${response.status})`;
          }
          
          throw new Error(errorMessage);
        }
        
        let responseData;
        try {
          const responseText = await response.text();
          console.log(`[VideoDetail] Success response text length:`, responseText.length);
          console.log(`[VideoDetail] Success response preview:`, responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''));
          
          if (!responseText.trim()) {
            throw new Error('Server returned empty response');
          }
          
          responseData = JSON.parse(responseText);
          console.log(`[VideoDetail] Parsed response keys:`, Object.keys(responseData));
          
          if (!responseData.video) {
            console.error(`[VideoDetail] Response missing video data:`, responseData);
            throw new Error('Server response missing video data');
          }
          
        } catch (parseError) {
          console.error(`[VideoDetail] Error parsing success response:`, parseError);
          throw new Error('Server returned invalid response format');
        }
        
        setVideo(responseData.video);
        
        console.log(`[VideoDetail] ✅ Video data received:`, {
          id: responseData.video?.id,
          title: responseData.video?.title,
          storageType: responseData.video?.storageType,
          hasVideoUrl: !!responseData.video?.bestVideoUrl,
          hasThumbnailUrl: !!responseData.video?.bestThumbnailUrl,
          hasGoogleDriveId: !!responseData.video?.googleDriveFileId,
          hasCloudinaryId: !!responseData.video?.cloudinaryPublicId,
          hasFilePath: !!responseData.video?.filePath,
          createdAt: responseData.video?.createdAt,
          createdAtType: typeof responseData.video?.createdAt
        });
        
        // Record view only once per session
        if (!viewRecorded.current) {
          viewRecorded.current = true;
          console.log(`[VideoDetail] Recording view for video ${id}`);
          fetch(`/api/videos/${id}/view`, { method: "POST" }).catch((err) => {
            console.error(`[VideoDetail] Failed to record view:`, err);
          });
        }
        
        // Check if user liked this video
        if (session?.user) {
          console.log(`[VideoDetail] Checking like status for video ${id}`);
          try {
            const likeResponse = await fetch(`/api/videos/${id}/liked`);
            if (likeResponse.ok) {
              const likeData = await likeResponse.json();
              setIsLiked(likeData.liked);
              console.log(`[VideoDetail] Like status: ${likeData.liked}`);
            } else {
              console.warn(`[VideoDetail] Failed to fetch like status: ${likeResponse.status}`);
            }
          } catch (likeError) {
            console.error(`[VideoDetail] Error checking like status:`, likeError);
          }
        }
        
      } catch (error) {
        console.error(`[VideoDetail] Error fetching video ${id}:`, error);
        setError(error instanceof Error ? error.message : "Video not found or unavailable");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchVideo();
    }
  }, [id, session, authChecked]);

  // Show loading state while checking authentication
  if (status === "loading" || !authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-pink-500"></div>
          <p className="mt-4 text-gray-300">Checking authentication...</p>
        </div>
      </div>
    );
  }

  const handleLike = async () => {
    if (!session?.user) {
      router.push("/login");
      return;
    }

    // Haptic feedback for mobile devices
    if (navigator.vibrate) {
      navigator.vibrate([50]); // Short vibration
    }

    // Optimistic update - update UI immediately
    const previousLiked = isLiked;
    const previousLikes = video?.likes || 0;
    
    // Update UI immediately for better UX
    setIsLiked(!isLiked);
    if (video) {
      setVideo({
        ...video,
        likes: isLiked ? previousLikes - 1 : previousLikes + 1,
      });
    }

    try {
      const response = await fetch(`/api/videos/${id}/like`, {
        method: "POST",
      });
      
      if (!response.ok) {
        throw new Error("Failed to like video");
      }
      
      const data = await response.json();
      
      // Update with actual server response
      setIsLiked(data.liked);
      if (video) {
        setVideo({
          ...video,
          likes: data.likes,
        });
      }
    } catch (error) {
      console.error("Error liking video:", error);
      
      // Revert optimistic update on error
      setIsLiked(previousLiked);
      if (video) {
        setVideo({
          ...video,
          likes: previousLikes,
        });
      }
      
      // Show error message to user
      alert("Failed to like video. Please try again.");
    }
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  const handleVideoClick = () => {
    togglePlayPause();
    
    // Show controls briefly when clicking
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-pink-500"></div>
          <p className="mt-4 text-gray-300">Loading video...</p>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-4 text-center">
        <div className="max-w-md w-full">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="mb-4 text-xl font-bold text-white">
            {error || "Video not found"}
          </h1>
          <div className="mb-6 text-gray-400 space-y-2">
            <p>The video you're looking for might have been removed or is unavailable.</p>
            {error && error.includes("HTTP") && (
              <p className="text-sm bg-gray-800 p-2 rounded">
                Error: {error}
              </p>
            )}
            <p className="text-sm">Video ID: {id}</p>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={() => {
                setError("");
                setIsLoading(true);
                // Retry fetching the video
                window.location.reload();
              }}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full font-medium hover:from-blue-600 hover:to-purple-600 transition-all"
            >
              🔄 Retry Loading
            </button>
            
            <Link
              href="/explore"
              className="block w-full px-6 py-2 bg-gray-800 text-white rounded-full font-medium hover:bg-gray-700 transition-all"
            >
              🔍 Browse Other Videos
            </Link>
            
            <Link
              href="/"
              className="block w-full px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full font-medium hover:from-pink-600 hover:to-purple-600 transition-all"
            >
              🏠 Back to Home
            </Link>
          </div>
          
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 p-3 bg-gray-800 rounded text-left text-xs text-gray-400">
              <p><strong>Debug Info:</strong></p>
              <p>• Check browser console for detailed logs</p>
              <p>• Check if video exists in database</p>
              <p>• Verify API endpoint is working</p>
              <p>• Test: <code>/api/videos/{id}</code></p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-900 pb-16">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-black py-3 px-4 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => router.back()} className="mr-4 text-white">
              <FaArrowLeft />
            </button>
            <h1 className="text-xl font-bold text-white truncate">{video.title}</h1>
          </div>
        </div>
      </header>

      {/* Video Player */}
      <div 
        className="relative w-full max-w-md mx-auto bg-black rounded-lg overflow-hidden shadow-2xl cursor-pointer" 
        style={{ aspectRatio: '9/16', maxHeight: '80vh' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setShowControls(false)}
      >
        {getVideoSources(video).length === 0 ? (
          // Show message when no valid video sources available
          <div className="w-full h-full flex items-center justify-center bg-gray-800 text-white">
            <div className="text-center p-8">
              <FaVideoSlash className="text-6xl text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Video Not Available</h3>
              <p className="text-gray-400 text-sm">
                This video is not available for playback.<br />
                The video format may not be supported.
              </p>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            src={getMP4VideoUrl(video) || undefined}
            poster={video.bestThumbnailUrl || video.thumbnailUrl || video.thumbnail}
            autoPlay
            loop
            playsInline
            onClick={handleVideoClick}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onLoadStart={() => {}}
            onCanPlay={() => {}}
            onError={(e) => {
              // Video error handled silently
            }}
          >
            {/* Multiple source elements for fallback */}
            {getVideoSources(video).map((url, index) => (
              <source key={index} src={url} type="video/mp4" />
            ))}
            Your browser does not support the video tag.
          </video>
        )}

        {/* Custom Play/Pause Button */}
        <div 
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <button
            className="bg-black/50 backdrop-blur-sm rounded-full p-4 border border-white/20 hover:bg-black/70 transition-all duration-200 transform hover:scale-110 pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
          >
            {isPlaying ? (
              <div className="w-6 h-6 flex items-center justify-center">
                <div className="flex space-x-1">
                  <div className="w-1.5 h-6 bg-white rounded-sm"></div>
                  <div className="w-1.5 h-6 bg-white rounded-sm"></div>
                </div>
      </div>
            ) : (
              <div className="w-6 h-6 flex items-center justify-center">
                <div className="w-0 h-0 border-l-[12px] border-l-white border-y-[8px] border-y-transparent ml-1"></div>
          </div>
            )}
          </button>
        </div>

        {/* Overlay controls */}
        <div className={`absolute top-4 right-4 flex space-x-2 transition-opacity duration-300 pointer-events-none ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}>
          <button
            onClick={handleLike}
            className={`p-3 rounded-full backdrop-blur-sm border transition-all duration-200 pointer-events-auto ${
              isLiked
                ? "bg-pink-500/80 border-pink-400 text-white"
                : "bg-black/50 border-white/20 text-white hover:bg-black/70"
            }`}
          >
            <FaHeart className={`text-lg ${isLiked ? 'animate-pulse' : ''}`} />
          </button>
          
          <button className="p-3 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 text-white hover:bg-black/70 transition-all duration-200 pointer-events-auto">
            <FaShare className="text-lg" />
          </button>
        </div>

        {/* Video info overlay */}
        <div className={`absolute bottom-4 left-4 right-4 transition-opacity duration-300 pointer-events-none ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className="bg-black/70 backdrop-blur-sm rounded-lg p-4 border border-white/10">
            <h2 className="text-white text-lg font-bold mb-2">{video.title}</h2>
            <div className="flex items-center justify-between text-sm text-gray-300">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <FaEye className="text-xs" />
                  <span>{video.views} views</span>
                </div>
                <div className="flex items-center space-x-1">
                  <FaHeart className="text-xs" />
                  <span>{video.likes} likes</span>
                </div>
              </div>
              <span>{getShortDate(video.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Video Information Section */}
      <div className="px-4 py-6 space-y-6">
        {/* Creator Info */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center ring-2 ring-pink-500/30">
              <span className="text-lg font-bold text-white">
                {video.admin.username.charAt(0).toUpperCase()}
              </span>
            </div>
              <div>
                <p className="font-semibold text-white">{video.admin.username}</p>
                <p className="text-sm text-gray-400">Creator</p>
              </div>
            </div>
            <button className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full text-sm font-medium hover:from-pink-600 hover:to-purple-600 transition-all">
              Follow
            </button>
          </div>
        </div>

        {/* Video Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 text-center border border-gray-700/50">
            <div className="text-pink-500 text-2xl mb-1">
              <FaEye className="mx-auto" />
            </div>
            <p className="text-white font-bold text-lg">{video.views.toLocaleString()}</p>
            <p className="text-gray-400 text-sm">Views</p>
          </div>
          
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 text-center border border-gray-700/50">
            <div className="text-red-500 text-2xl mb-1">
              <FaHeart className="mx-auto" />
            </div>
            <p className="text-white font-bold text-lg">{video.likes.toLocaleString()}</p>
            <p className="text-gray-400 text-sm">Likes</p>
          </div>
          
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 text-center border border-gray-700/50">
            <div className="text-blue-500 text-2xl mb-1">
              <FaCalendar className="mx-auto" />
            </div>
            <p className="text-white font-bold text-sm">
              {getShortDate(video.createdAt)}
            </p>
            <p className="text-gray-400 text-sm">Posted</p>
          </div>
        </div>

        {/* Video Title & Description */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
          <h2 className="text-xl font-bold text-white mb-3">{video.title}</h2>
        {video.description && (
            <div>
              <p className="text-gray-300 leading-relaxed whitespace-pre-line">
                {video.description}
              </p>
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-gray-700/50">
            <p className="text-sm text-gray-400">
              Published on {getLongDate(video.createdAt)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={handleLike}
            className={`flex items-center justify-center space-x-2 p-4 rounded-xl font-medium transition-all duration-200 ${
              isLiked
                ? "bg-gradient-to-r from-pink-500 to-red-500 text-white"
                : "bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 text-gray-300 hover:bg-gray-700/50"
            }`}
          >
            <FaHeart className={`text-lg ${isLiked ? 'animate-pulse' : ''}`} />
            <span>{isLiked ? 'Liked' : 'Like'}</span>
          </button>
          
          <button className="flex items-center justify-center space-x-2 p-4 bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 text-gray-300 rounded-xl font-medium hover:bg-gray-700/50 transition-all duration-200">
            <FaShare className="text-lg" />
            <span>Share</span>
          </button>
        </div>
      </div>

    </main>
  );
} 