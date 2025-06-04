"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FaPlus, FaSearch, FaEye, FaHeart, FaClock, FaSort, FaEdit, FaTrash, FaImage, FaChevronLeft, FaChevronRight, FaUpload, FaVideo } from "react-icons/fa";
import AdminLayout from "@/components/AdminLayout";
import ClearCacheButton from "@/components/ClearCacheButton";
import { useSession } from "next-auth/react";
import { getThumbnailUrl } from "@/lib/videoService.client";
import { useThumbnailCache } from "@/hooks/useThumbnailCache";

interface Video {
  id: string;
  title: string;
  description: string | null;
  views: number;
  likes: number;
  thumbnail: string | null;
  createdAt: string;
  timeAgo?: string;
  storageType?: 'cloudinary' | 'local';
  admin?: {
    id: string;
    username: string;
  };
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export default function VideosManagement() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<keyof Video>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    limit: 10,
    offset: 0,
    hasMore: false
  });
  
  const { data: session } = useSession();
  const router = useRouter();
  
  // Add thumbnail cache management
  const { clearCache, scanThumbnails, loading: cacheLoading, error: cacheError } = useThumbnailCache();

  const fetchVideos = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Calculate offset based on current page
      const offset = (currentPage - 1) * pagination.limit;
      
      const queryParams = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: offset.toString(),
        sortBy,
        sortOrder,
      });

      
      const response = await fetch(`/api/admin/videos?${queryParams}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch videos: ${response.status}`);
      }
      
      const data = await response.json();
      
      
      // Debug thumbnail URLs
      data.videos.forEach((video: Video, index: number) => {
      });
      
      // AGGRESSIVE DEDUPLICATION: Remove any duplicates before setting state
      const uniqueVideos = data.videos.reduce((acc: Video[], current: Video) => {
        const isDuplicate = acc.some(video => video.id === current.id);
        if (!isDuplicate) {
          acc.push(current);
        } else {
          console.warn(`🔄 Removed duplicate video from UI: ${current.id} - "${current.title}"`);
        }
        return acc;
      }, []);
      
      
      setVideos(uniqueVideos);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching videos:", error);
      setError("Failed to load videos. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pagination.limit, sortBy, sortOrder]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  useEffect(() => {
    // Reset to page 1 when search query changes
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [searchQuery, currentPage]);

  const handleEditVideo = (videoId: string) => {
    router.push(`/admin/edit/${videoId}`);
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      return;
    }
    
    try {
      
      const response = await fetch(`/api/admin/videos/${videoId}`, {
        method: 'DELETE',
      });
      
      
      if (!response.ok) {
        let errorMessage = "Failed to delete video";
        try {
          const errorData = await response.json();
          console.error(`[Frontend] Delete error data:`, errorData);
          errorMessage = errorData.message || errorData.details || errorData.error || errorMessage;
          
          // Special handling for 404 - video doesn't exist
          if (response.status === 404) {
            // Remove from UI even though it wasn't in database
            setVideos(videos.filter(video => video.id !== videoId));
            setError("Video was already deleted or doesn't exist in the database. Removed from list.");
            return; // Exit early since we handled it
          }
        } catch (parseError) {
          console.error(`[Frontend] Failed to parse error response:`, parseError);
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      
      // Update the videos list after deletion
      setVideos(videos.filter(video => video.id !== videoId));
      setError(""); // Clear any previous errors
      
      // Show success message briefly
      if (result.message) {
      }
      
    } catch (error) {
      console.error("[Frontend] Error deleting video:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete video. Please try again.";
      setError(`Failed to delete video: ${errorMessage}`);
    }
  };

  const toggleSortOrder = useCallback((field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field as keyof Video);
      setSortOrder("desc");
    }
    // Reset to page 1 when sorting changes
    setCurrentPage(1);
  }, [sortBy]);

  // Client-side filtering for search (only filter current page results)
  const filteredVideos = videos.filter(video => 
    video.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (video.description && video.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const handlePageChange = useCallback((page: number) => {
    if (page !== currentPage && page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [currentPage, totalPages]);

  // Add refresh thumbnail cache function
  const handleRefreshThumbnailCache = useCallback(async () => {
    try {
      await clearCache();
      // Refresh video list after cache clear
      await fetchVideos();
    } catch (error) {
      console.error("Failed to refresh thumbnail cache:", error);
    }
  }, [clearCache, fetchVideos]);

  // Add scan thumbnails function for debugging
  const handleScanThumbnails = useCallback(async () => {
    try {
      const result = await scanThumbnails();
      alert(`Found ${result.count} thumbnail files. Check console for details.`);
    } catch (error) {
      console.error("Failed to scan thumbnails:", error);
    }
  }, [scanThumbnails]);

  return (
    <AdminLayout title="Videos Management">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">Videos Management</h2>
          <p className="text-gray-500">Manage all videos in your platform</p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-3">
          <button
            onClick={fetchVideos}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <FaSearch className="mr-2" />
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <ClearCacheButton />
          <button
            onClick={() => router.push("/admin/bulk-upload")}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-medium rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-colors"
          >
            <FaUpload className="mr-2" />
            Bulk Upload
          </button>
          <button
            onClick={() => router.push("/admin/upload")}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-medium rounded-lg hover:from-pink-600 hover:to-purple-600 transition-colors"
          >
            <FaPlus className="mr-2" />
            Upload New Video
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaSearch className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search videos by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-colors"
            />
          </div>
        </div>
        
        {error && (
          <div className="p-4 bg-red-50 text-red-500 border-b border-red-100">
            {error}
          </div>
        )}
        
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
          </div>
        ) : filteredVideos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Thumbnail <span className="text-gray-400">(9:16)</span>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => toggleSortOrder("title")}
                  >
                    <div className="flex items-center">
                      Title
                      {sortBy === "title" && (
                        <FaSort className="ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => toggleSortOrder("views")}
                  >
                    <div className="flex items-center">
                      Views
                      {sortBy === "views" && (
                        <FaSort className="ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => toggleSortOrder("likes")}
                  >
                    <div className="flex items-center">
                      Likes
                      {sortBy === "likes" && (
                        <FaSort className="ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => toggleSortOrder("createdAt")}
                  >
                    <div className="flex items-center">
                      Date Added
                      {sortBy === "createdAt" && (
                        <FaSort className="ml-1" />
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredVideos.map((video) => (
                  <tr key={video.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-16 bg-gray-200 rounded overflow-hidden relative border border-gray-300 aspect-[9/16]">
                        {video.thumbnail && video.thumbnail.trim() !== '' && !video.thumbnail.includes('admin/videos') ? (
                          <>
                            <Image 
                              src={getThumbnailUrl(video as any)}
                              alt={video.title}
                              width={64}
                              height={114}
                              className="object-cover w-full h-full"
                              onError={(e) => {
                                console.error(`[Thumbnail Error] Failed to load: ${getThumbnailUrl(video as any)}`);
                                // Hide the image if it fails to load
                                e.currentTarget.style.display = 'none';
                              }}
                              onLoad={() => {
                              }}
                            />
                            {/* Storage type badge */}
                            <div className="absolute top-1 right-1">
                              <span className={`text-xs px-1 py-0.5 rounded text-white font-bold shadow-sm ${
                                video.storageType === 'cloudinary' ? 'bg-blue-500' : 'bg-gray-500'
                              }`}>
                                {video.storageType === 'cloudinary' ? 'CDN' : 'LOC'}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full bg-gradient-to-r from-gray-300 to-gray-200 flex items-center justify-center">
                            <div className="text-center">
                              <FaImage className="mx-auto h-4 w-4 text-gray-500 mb-1" />
                              <span className="text-xs text-gray-600 font-medium">No thumbnail</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{video.title}</div>
                      {video.description && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {video.description}
                        </div>
                      )}
                      {/* Creator info */}
                      {video.admin && (
                        <div className="text-xs text-gray-400 mt-1">
                          by {video.admin.username}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 flex items-center">
                        <FaEye className="mr-1 text-blue-400" /> 
                        {video.views.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 flex items-center">
                        <FaHeart className="mr-1 text-pink-400" /> 
                        {video.likes.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 flex items-center">
                        <FaClock className="mr-1 text-gray-400" /> 
                        <div>
                          <div>{video.timeAgo || new Date(video.createdAt).toLocaleDateString()}</div>
                          <div className="text-xs text-gray-400">
                            {new Date(video.createdAt).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEditVideo(video.id)}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                          title="Edit video"
                        >
                          <FaEdit className="mr-1.5 text-xs" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteVideo(video.id)}
                          className="inline-flex items-center px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                          title="Delete video"
                        >
                          <FaTrash className="mr-1.5 text-xs" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No videos found. {searchQuery ? "Try a different search query." : "Upload your first video."}
          </div>
        )}
        
        {/* Pagination */}
        {!isLoading && videos.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              {/* Page Info */}
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{pagination.offset + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(pagination.offset + pagination.limit, pagination.total)}
                </span>{' '}
                of <span className="font-medium">{pagination.total}</span> videos
              </div>
              
              {/* Navigation */}
              <div className="flex items-center space-x-2">
                {/* Previous Button */}
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="relative inline-flex items-center px-3 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                >
                  <FaChevronLeft className="h-3 w-3" />
                  Previous
                </button>
                
                {/* Page Numbers */}
                <div className="flex space-x-1">
                  {/* First page */}
                  {totalPages > 5 && currentPage > 3 && (
                    <>
                      <button
                        onClick={() => handlePageChange(1)}
                        className="relative inline-flex items-center px-3 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                      >
                        1
                      </button>
                      {currentPage > 4 && (
                        <span className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500">
                          ...
                        </span>
                      )}
                    </>
                  )}
                  
                  {/* Current page and neighbors */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    if (pageNum < 1 || pageNum > totalPages) return null;
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`relative inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md transition-colors ${
                          pageNum === currentPage
                            ? 'bg-pink-500 border-pink-500 text-white'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  {/* Last page */}
                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      {currentPage < totalPages - 3 && (
                        <span className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500">
                          ...
                        </span>
                      )}
                      <button
                        onClick={() => handlePageChange(totalPages)}
                        className="relative inline-flex items-center px-3 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>
                
                {/* Next Button */}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="relative inline-flex items-center px-3 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                >
                  Next
                  <FaChevronRight className="h-3 w-3 ml-1" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="sm:flex sm:items-center mb-8">
        <div className="sm:flex-auto">
          <h1 className="text-3xl font-bold leading-tight text-gray-900">
            Video Management
          </h1>
          <p className="mt-2 text-base text-gray-600">
            Manage and organize your video content
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-3">
          {/* Add thumbnail cache refresh button */}
          <button
            onClick={handleRefreshThumbnailCache}
            disabled={cacheLoading}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 disabled:opacity-50"
            title="Refresh thumbnail cache - fixes thumbnails not appearing after upload"
          >
            🔄 {cacheLoading ? 'Refreshing...' : 'Refresh Thumbnails'}
          </button>
          
          {/* Debug scan button (only show in development) */}
          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={handleScanThumbnails}
              disabled={cacheLoading}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 disabled:opacity-50"
              title="Scan thumbnail directory (debug)"
            >
              🔍 Scan Thumbnails
            </button>
          )}
          
          <button
            onClick={() => router.push('/admin/upload')}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-pink-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2"
          >
            <FaVideo className="mr-2" />
            Add Video
          </button>
        </div>
      </div>

      {/* Show cache error if any */}
      {cacheError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="text-sm text-red-700">
              Cache Error: {cacheError}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
} 
