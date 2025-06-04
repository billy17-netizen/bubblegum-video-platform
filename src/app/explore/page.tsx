"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FaArrowLeft, 
  FaSearch, 
  FaHeart, 
  FaEye, 
  FaPlay, 
  FaFire,
  FaClock,
  FaChartLine,
  FaRandom,
  FaMusic,
  FaUser,
  FaFilter,
  FaTimes,
  FaHeart as FaHeartFilled,
  FaBookmark,
  FaShare,
  FaComment,
  FaPause
} from "react-icons/fa";
import BottomNavigation from "@/components/BottomNavigation";
import { getThumbnailUrl, getVideoUrl } from "@/lib/videoService.client";

interface VideoData {
  id: string;
  title: string;
  thumbnail: string | null;
  likes: number;
  views: number;
  filePath: string;
  description?: string;
  createdAt: string | Date | any;
  admin: {
    username: string;
  };
  bestVideoUrl?: string;
  bestThumbnailUrl?: string;
  storageType?: 'cloudinary' | 'local' | 'google-drive' | 'bunny';
  // Google Drive fields
  googleDriveFileId?: string | null;
  googleDriveVideoUrl?: string | null;
  googleDriveThumbnailId?: string | null;
  googleDriveThumbnailUrl?: string | null;
  // Cloudinary fields
  cloudinaryPublicId?: string | null;
  cloudinaryUrl?: string | null;
  thumbnailPublicId?: string | null;
  thumbnailUrl?: string | null;
  // Bunny.net fields
  bunnyVideoId?: string | null;
  bunnyStreamUrl?: string | null;
  bunnyThumbnailUrl?: string | null;
}

const categories = [
  { id: 'all', name: 'For You', icon: <FaFire />, color: 'from-pink-500 to-red-500' },
  { id: 'trending', name: 'Trending', icon: <FaChartLine />, color: 'from-red-500 to-orange-500' },
  { id: 'recent', name: 'Latest', icon: <FaClock />, color: 'from-blue-500 to-purple-500' },
  { id: 'popular', name: 'Popular', icon: <FaFire />, color: 'from-purple-500 to-pink-500' },
  { id: 'random', name: 'Discover', icon: <FaRandom />, color: 'from-green-500 to-teal-500' },
];

export default function ExplorePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filteredVideos, setFilteredVideos] = useState<VideoData[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement }>({});

  // Create a simple file path for placeholder instead of data URL
  const placeholderImageUrl = "/placeholder-thumbnail-vertical.svg";

  // Check authentication
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Fetch videos
  useEffect(() => {
    const fetchVideos = async () => {
      if (videos.length === 0) {
        setIsLoading(true);
      }
      try {
        const response = await fetch("/api/videos?limit=100");
        if (response.ok) {
          const data = await response.json();
          console.log('Videos data received:', data.videos?.slice(0, 2)); // Debug first 2 videos
          console.log('Sample video createdAt values:', data.videos?.slice(0, 3).map((v: any) => ({
            id: v.id,
            title: v.title,
            createdAt: v.createdAt,
            createdAtType: typeof v.createdAt,
            createdAtKeys: typeof v.createdAt === 'object' ? Object.keys(v.createdAt || {}) : 'not-object',
            createdAtStringified: JSON.stringify(v.createdAt)
          })));
          setVideos(data.videos);
        } else {
          console.error("Failed to fetch videos");
        }
      } catch (error) {
        console.error("Error fetching videos:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (session?.user) {
      fetchVideos();
    }
  }, [session]);

  // Filter and sort videos based on category and search
  useEffect(() => {
    let filtered = [...videos];

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(video => 
        video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.admin.username.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category sorting
    switch (selectedCategory) {
      case 'all':
        // Mix of trending and recent for "For You" feed
        filtered.sort((a, b) => {
          const now = new Date().getTime();
          const dateA = new Date(a.createdAt);
          const dateB = new Date(b.createdAt);
          
          // Handle invalid dates
          const timeA = isNaN(dateA.getTime()) ? now : dateA.getTime();
          const timeB = isNaN(dateB.getTime()) ? now : dateB.getTime();
          
          const daysA = Math.max(1, Math.floor((now - timeA) / (1000 * 60 * 60 * 24)));
          const daysB = Math.max(1, Math.floor((now - timeB) / (1000 * 60 * 60 * 24)));
          
          const scoreA = (a.likes * 2 + a.views) / daysA;
          const scoreB = (b.likes * 2 + b.views) / daysB;
          
          return scoreB - scoreA;
        });
        break;
      case 'trending':
        filtered.sort((a, b) => (b.likes + b.views) - (a.likes + a.views));
        break;
      case 'recent':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'popular':
        filtered.sort((a, b) => b.likes - a.likes);
        break;
      case 'random':
        filtered.sort(() => Math.random() - 0.5);
        break;
      default:
        break;
    }

    setFilteredVideos(filtered);
  }, [videos, searchQuery, selectedCategory]);

  const handleVideoClick = (videoId: string) => {
    // Stop any playing preview
    if (previewVideo && videoRefs.current[previewVideo]) {
      videoRefs.current[previewVideo].pause();
    }
    router.push(`/video/${videoId}`);
  };

  const handleVideoHover = (videoId: string, isHovering: boolean) => {
    setHoveredVideo(isHovering ? videoId : null);
    
    if (isHovering) {
      // Start preview after 1 second
      setTimeout(() => {
        if (hoveredVideo === videoId && videoRefs.current[videoId]) {
          setPreviewVideo(videoId);
          videoRefs.current[videoId].play().catch(() => {
            // Silent fail for autoplay issues
          });
        }
      }, 1000);
    } else {
      // Stop preview
      if (videoRefs.current[videoId]) {
        videoRefs.current[videoId].pause();
        videoRefs.current[videoId].currentTime = 0;
      }
      if (previewVideo === videoId) {
        setPreviewVideo(null);
      }
    }
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    } else {
      return count.toString();
    }
  };

  const getTimeAgo = (dateInput: string | Date | any): string => {
    // Handle empty or null values
    if (!dateInput) {
      console.warn('[getTimeAgo] Empty or null dateInput received');
      return 'Unknown';
    }
    
    const now = new Date();
    let date: Date;
    
    try {
      // Handle different input types
      if (dateInput instanceof Date) {
        // Already a Date object
        date = dateInput;
      } else if (typeof dateInput === 'string') {
        // String input - try parsing
        date = new Date(dateInput);
        
        // If that fails, try ISO string parsing
        if (isNaN(date.getTime())) {
          // Handle potential timezone issues
          if (!dateInput.includes('T') && !dateInput.includes('Z')) {
            // If it's a date without time, add time
            date = new Date(dateInput + 'T00:00:00.000Z');
          } else {
            date = new Date(dateInput.replace(' ', 'T'));
          }
        }
      } else if (typeof dateInput === 'number') {
        // Timestamp input
        date = new Date(dateInput);
      } else if (typeof dateInput === 'object' && dateInput !== null) {
        // Object input - check for common date object structures
        console.log('[getTimeAgo] Processing object input:', dateInput);
        
        // First check if object is empty
        const keys = Object.keys(dateInput);
        if (keys.length === 0) {
          console.warn('[getTimeAgo] Empty object received, using current time as fallback');
          return 'Just now';
        }
        
        // Check if it's a Prisma Date object or similar
        if (dateInput.toString && typeof dateInput.toString === 'function') {
          const dateString = dateInput.toString();
          console.log('[getTimeAgo] Object toString result:', dateString);
          
          // Check if toString returns a valid date string (not just "[object Object]")
          if (dateString !== '[object Object]') {
            date = new Date(dateString);
          } else {
            // Try to find date properties in the object
            const possibleDateProps = ['value', 'date', 'timestamp', '_date', '$date'];
            let foundDate = null;
            
            for (const prop of possibleDateProps) {
              if (dateInput[prop]) {
                foundDate = dateInput[prop];
                break;
              }
            }
            
            if (foundDate) {
              console.log('[getTimeAgo] Found date in property:', foundDate);
              date = new Date(foundDate);
            } else {
              console.error('[getTimeAgo] Empty object with no valid date properties:', dateInput);
              return 'Unknown';
            }
          }
        } else if (dateInput.toISOString && typeof dateInput.toISOString === 'function') {
          date = new Date(dateInput.toISOString());
        } else {
          console.error('[getTimeAgo] Unknown object format:', dateInput);
          return 'Unknown';
        }
      } else {
        console.error('[getTimeAgo] Unsupported input type:', typeof dateInput, dateInput);
        return 'Unknown';
      }
    } catch (parseError) {
      console.error('[getTimeAgo] Date parsing error:', parseError, 'for dateInput:', dateInput);
      return 'Unknown';
    }
    
    // Final check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('[getTimeAgo] Invalid date after all parsing attempts:', dateInput);
      return 'Unknown';
    }
    
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    // Handle negative time differences (future dates)
    if (diffInSeconds < 0) {
      return 'Just now';
    }
    
    // Return appropriate time format
    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    if (diffInSeconds < 2629746) return `${Math.floor(diffInSeconds / 604800)}w`;
    return `${Math.floor(diffInSeconds / 2629746)}mo`;
  };

  if (status === "loading") {
    if (!session) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-black">
          <div className="flex flex-col items-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-pink-500"></div>
            <p className="mt-4 text-gray-300 font-medium">Loading Bubblegum...</p>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-black text-white font-chivo">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b border-gray-800">
        <div className="px-4 py-3">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Link href="/" className="text-white/80 hover:text-white transition-colors">
                <FaArrowLeft size={20} />
              </Link>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
                Discover
              </h1>
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
            >
              <FaFilter className="text-white/80" size={16} />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search videos, creators, sounds..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-900 text-white pl-12 pr-4 py-3 rounded-2xl border border-gray-800 focus:border-pink-500 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <FaTimes size={16} />
              </button>
            )}
          </div>

          {/* Categories */}
          <div className="flex space-x-2 overflow-x-auto scrollbar-hide">
            {categories.map((category, index) => (
              <motion.button
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl whitespace-nowrap transition-all duration-300 ${
                  selectedCategory === category.id
                    ? `bg-gradient-to-r ${category.color} text-white shadow-lg scale-105`
                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-700/50'
                }`}
              >
                {category.icon}
                <span className="text-sm font-semibold">{category.name}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-2 py-4">
        {/* Results Info */}
        <div className="px-2 mb-4">
          <div className="text-gray-400 text-sm">
            {isLoading ? (
              <span className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                <span>Discovering videos...</span>
              </span>
            ) : (
              <>
                <span className="text-white font-semibold">{filteredVideos.length}</span> videos
                {searchQuery && (
                  <span className="text-pink-400"> matching "{searchQuery}"</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Videos Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="aspect-[9/16] bg-gray-800 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : filteredVideos.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="text-gray-600 text-8xl mb-6">🎬</div>
            <h3 className="text-white text-xl font-bold mb-2">No videos found</h3>
            <p className="text-gray-400 mb-6 max-w-sm">
              {searchQuery 
                ? `We couldn't find any videos matching "${searchQuery}". Try different keywords or explore trending content.`
                : `No videos available in this category right now.`
              }
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full font-semibold hover:shadow-lg transition-all"
              >
                Clear Search
              </button>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredVideos.map((video, index) => {
              const thumbnailUrl = getThumbnailUrl(video as any) || placeholderImageUrl;
              const videoUrl = getVideoUrl(video as any);
              const isHovered = hoveredVideo === video.id;
              const isPlaying = previewVideo === video.id;
              
              return (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  onMouseEnter={() => handleVideoHover(video.id, true)}
                  onMouseLeave={() => handleVideoHover(video.id, false)}
                  onClick={() => handleVideoClick(video.id)}
                  className="relative bg-gray-900 rounded-2xl overflow-hidden cursor-pointer group hover:scale-[1.02] transition-all duration-300"
                >
                  {/* Video/Thumbnail Container */}
                  <div className="relative aspect-[9/16] overflow-hidden">
                    {/* Thumbnail */}
                    <img
                      src={thumbnailUrl}
                      alt={video.title}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                        isPlaying ? 'opacity-0' : 'opacity-100'
                      }`}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = placeholderImageUrl;
                      }}
                    />
                    
                    {/* Preview Video - only render if videoUrl exists */}
                    {videoUrl && (
                      <video
                        ref={(el) => {
                          if (el) videoRefs.current[video.id] = el;
                        }}
                        src={videoUrl}
                        muted
                        loop
                        playsInline
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                          isPlaying ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    )}
                    
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    
                    {/* Play/Pause Button */}
                    <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
                      isHovered ? 'opacity-100' : 'opacity-0'
                    }`}>
                      <div className="bg-black/50 backdrop-blur-sm rounded-full p-4">
                        {isPlaying ? (
                          <FaPause className="text-white text-xl" />
                        ) : (
                          <FaPlay className="text-white text-xl ml-1" />
                        )}
                      </div>
                    </div>
                    
                    {/* Top Indicators */}
                    <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
                      {/* Trending Badge */}
                      {(video.likes + video.views) > 1000 && (
                        <div className="flex items-center space-x-1 bg-gradient-to-r from-orange-500 to-red-500 px-2 py-1 rounded-full">
                          <FaFire size={10} />
                          <span className="text-xs font-bold">HOT</span>
                        </div>
                      )}
                      
                      {/* Duration/Time */}
                      <div className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
                        <span className="text-xs font-medium">
                          {getTimeAgo(video.createdAt)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Bottom Content */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      {/* Creator Info */}
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
                          <FaUser size={10} />
                        </div>
                        <span className="text-white text-xs font-semibold">@{video.admin.username}</span>
                      </div>
                      
                      {/* Title */}
                      <h3 className="text-white text-sm font-semibold line-clamp-2 mb-2 leading-tight">
                        {video.title}
                      </h3>
                      
                      {/* Stats */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-1">
                            <FaHeart className="text-red-500" size={12} />
                            <span className="text-white text-xs font-medium">
                              {formatCount(video.likes)}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <FaEye className="text-blue-400" size={12} />
                            <span className="text-white text-xs font-medium">
                              {formatCount(video.views)}
                            </span>
                          </div>
                        </div>
                        
                        {/* Music Indicator */}
                        <div className="flex items-center space-x-1 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full">
                          <FaMusic size={8} className="text-pink-400" />
                          <span className="text-xs text-white/80">Original</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filters Modal */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-end"
            onClick={() => setShowFilters(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full bg-gray-900 rounded-t-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Filters</h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors"
                >
                  <FaTimes />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-semibold mb-3">Sort by</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => {
                          setSelectedCategory(category.id);
                          setShowFilters(false);
                        }}
                        className={`flex items-center space-x-2 p-3 rounded-xl transition-all ${
                          selectedCategory === category.id
                            ? `bg-gradient-to-r ${category.color} text-white`
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {category.icon}
                        <span className="font-medium">{category.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <BottomNavigation />
      
      {/* Custom Scrollbar Styles */}
      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
} 