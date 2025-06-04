"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { FaPlay, FaHeart, FaEye, FaUser, FaCalendar } from "react-icons/fa";
import { motion } from "framer-motion";
import { getThumbnailUrl } from "@/lib/videoService.client";

interface VideoCardProps {
  video: {
    id: string;
    title: string;
    thumbnail?: string;
    likes: number;
    views: number;
    createdAt: string;
    admin: {
      username: string;
    };
    // All storage types
    filePath?: string;
    cloudinaryPublicId?: string;
    cloudinaryUrl?: string;
    thumbnailUrl?: string;
    googleDriveFileId?: string;
    googleDriveVideoUrl?: string;
    bunnyVideoId?: string;
    bunnyStreamUrl?: string;
    bunnyThumbnailUrl?: string;
    storageType?: string;
  };
  className?: string;
  showStats?: boolean;
  showAdmin?: boolean;
}

export default function VideoCard({ 
  video, 
  className = "", 
  showStats = true, 
  showAdmin = true 
}: VideoCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  // Get optimized thumbnail URL with proper validation
  const thumbnailUrl = getThumbnailUrl(video as any);

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    } else {
      return count.toString();
    }
  };

  const getTimeAgo = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const handleImageError = () => {
    console.error(`[VideoCard] Thumbnail failed to load: ${thumbnailUrl}`);
    setImageError(true);
    // Don't set fallback image directly, let the error placeholder show instead
  };

  // Validate thumbnail URL before rendering
  const isValidThumbnail = thumbnailUrl && 
    thumbnailUrl.trim() !== '' && 
    !thumbnailUrl.includes('admin/videos') &&
    !thumbnailUrl.includes('localhost:3000/admin');

  return (
    <Link href={`/video/${video.id}`}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition-all cursor-pointer group shadow-lg ${className}`}
      >
        {/* Video Thumbnail */}
        <div className="relative aspect-video bg-gray-900">
          {isValidThumbnail && !imageError && (
            <img
              ref={imageRef}
              src={thumbnailUrl}
              alt={video.title}
              className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={handleImageError}
              loading="lazy"
            />
          )}
          
          {/* Loading placeholder */}
          {!imageLoaded && !imageError && isValidThumbnail && (
            <div className="absolute inset-0 bg-gray-700 animate-pulse flex items-center justify-center">
              <div className="text-gray-500 text-2xl">📹</div>
            </div>
          )}
          
          {/* Error placeholder or invalid thumbnail */}
          {(imageError || !isValidThumbnail) && (
            <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
              <div className="text-center">
                <div className="text-gray-500 text-3xl mb-2">🎬</div>
                <span className="text-gray-400 text-sm">No thumbnail</span>
              </div>
            </div>
          )}

          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
            <div className="bg-pink-500 rounded-full p-4 text-white shadow-lg">
              <FaPlay className="text-xl ml-1" />
            </div>
          </div>

          {/* Duration placeholder (could be enhanced with actual duration) */}
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm text-white text-xs rounded">
            HD
          </div>
        </div>

        {/* Video Info */}
        <div className="p-4">
          <h3 className="font-semibold text-white text-sm line-clamp-2 mb-3 leading-5">
            {video.title}
          </h3>
          
          {showAdmin && (
            <div className="flex items-center space-x-2 mb-3 text-gray-400">
              <div className="w-6 h-6 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center text-xs text-white">
                <FaUser />
              </div>
              <span className="text-sm">@{video.admin.username}</span>
            </div>
          )}
          
          {showStats && (
            <div className="flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <FaHeart className="text-pink-500" />
                  <span className="text-white">
                    {formatCount(video.likes)}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <FaEye className="text-blue-400" />
                  <span className="text-white">
                    {formatCount(video.views)}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center space-x-1">
                <FaCalendar className="text-gray-500" />
                <span>{getTimeAgo(video.createdAt)}</span>
              </div>
            </div>
          )}

          {/* Trending indicator */}
          {(video.likes + video.views) > 100 && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <div className="flex items-center space-x-1 text-orange-400 text-xs">
                <span>🔥</span>
                <span className="font-medium">Trending</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </Link>
  );
} 