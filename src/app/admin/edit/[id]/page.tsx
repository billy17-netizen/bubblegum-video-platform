"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Poppins } from "next/font/google";
import { motion } from "framer-motion";
import { FaArrowLeft, FaSave, FaTimes, FaUpload, FaImage, FaTrash, FaEye, FaHeart, FaClock } from "react-icons/fa";
import Image from "next/image";
import { getVideoUrl, getSafeVideoUrl, getThumbnailUrl, getVideoUrlsWithFallbacks } from "@/lib/videoService.client";
import AdminLayout from "@/components/AdminLayout";

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-poppins",
});

interface VideoData {
  id: string;
  title: string;
  description: string | null;
  views: number;
  likes: number;
  videoUrl: string;
  thumbnail: string | null;
  thumbnailUrl: string | null;
  cloudinaryPublicId: string | null;
  thumbnailPublicId: string | null;
  storageType: 'cloudinary' | 'local' | 'bunny' | 'googledrive';
  createdAt: string;
  
  // Additional fields for video service
  filePath?: string;
  cloudinaryUrl?: string;
  bunnyVideoId?: string;
  bunnyStreamUrl?: string;
  bunnyThumbnailUrl?: string;
}

// Utility function untuk parsing tanggal yang aman - versi sederhana
const formatSafeDate = (dateInput: any): string => {
  console.log('[formatSafeDate] Input:', dateInput, typeof dateInput);
  
  if (!dateInput) {
    return 'Tanggal tidak tersedia';
  }
  
  try {
    // Coba berbagai cara parsing
    let dateObj: Date;
    
    if (dateInput instanceof Date) {
      dateObj = dateInput;
    } else if (typeof dateInput === 'string') {
      dateObj = new Date(dateInput);
    } else if (typeof dateInput === 'number') {
      dateObj = new Date(dateInput);
    } else {
      // Untuk object, coba convert ke string dulu
      const strDate = String(dateInput);
      dateObj = new Date(strDate);
      
      // Jika gagal, coba cari property yang mengandung tanggal
      if (isNaN(dateObj.getTime())) {
        const possibleKeys = ['createdAt', 'date', 'timestamp', 'value'];
        for (const key of possibleKeys) {
          if (dateInput[key]) {
            dateObj = new Date(dateInput[key]);
            if (!isNaN(dateObj.getTime())) break;
          }
        }
      }
    }
    
    // Validasi akhir
    if (isNaN(dateObj.getTime())) {
      console.log('[formatSafeDate] Failed to parse date');
      return 'Tanggal tidak valid';
    }
    
    // Format dalam bahasa Indonesia
    return dateObj.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric'
    });
    
  } catch (error) {
    console.error('[formatSafeDate] Error:', error);
    return 'Error parsing tanggal';
  }
};

export default function EditVideo() {
  const params = useParams();
  const videoId = params.id as string;
  
  const router = useRouter();
  const { data: session, status } = useSession();
  const [video, setVideo] = useState<VideoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState<string>("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.push("/");
    } else if (status === "authenticated") {
      fetchVideo();
    }
  }, [status, session, router, videoId]);
  
  const fetchVideo = async () => {
    setIsLoading(true);
    setError("");
    
    try {
      const response = await fetch(`/api/admin/videos/${videoId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('[EditVideo] API error:', errorData);
        throw new Error(errorData.error || "Failed to fetch video");
      }
      
      const data = await response.json();
      
      setVideo(data.video);
      setTitle(data.video.title);
      setDescription(data.video.description || "");
    } catch (error) {
      console.error("Error fetching video:", error);
      setError("Failed to load video data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const removeThumbnailPreview = () => {
    setThumbnailFile(null);
    setThumbnailPreview(null);
    if (thumbnailInputRef.current) {
      thumbnailInputRef.current.value = "";
    }
  };

  const updateThumbnail = async () => {
    if (!thumbnailFile) return null;

    setIsUploadingThumbnail(true);
    try {
      const formData = new FormData();
      formData.append("thumbnail", thumbnailFile);

      const response = await fetch(`/api/admin/videos/${videoId}/thumbnail`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update thumbnail");
      }

      const data = await response.json();
      return data.thumbnail;
    } catch (error) {
      console.error("Error updating thumbnail:", error);
      throw error;
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const deleteThumbnail = async () => {
    if (!confirm('Are you sure you want to delete the current thumbnail?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/videos/${videoId}/thumbnail`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete thumbnail");
      }

      // Refresh video data
      await fetchVideo();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error deleting thumbnail:", error);
      setSaveError("Failed to delete thumbnail. Please try again.");
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError("");
    setSaveSuccess(false);
    
    if (!title.trim()) {
      setSaveError("Title is required");
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Update thumbnail first if there's a new one
      let thumbnailData = null;
      if (thumbnailFile) {
        thumbnailData = await updateThumbnail();
      }

      // Update video data
      const response = await fetch(`/api/admin/videos/${videoId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description: description || null,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update video");
      }
      
      const updatedData = await response.json();
      setVideo(updatedData.video);
      setSaveSuccess(true);
      
      // Clear thumbnail preview if it was uploaded
      if (thumbnailFile) {
        removeThumbnailPreview();
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error("Error updating video:", error);
      setSaveError(error instanceof Error ? error.message : "Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading video data...</p>
        </div>
      </div>
    );
  }
  
  if (error || !video) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 flex-col">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg border border-gray-200">
          <div className="text-red-600 text-xl mb-4 font-semibold">{error || "Video not found"}</div>
          <p className="text-gray-600 mb-6">Please check the video ID and try again.</p>
          <button 
            onClick={() => router.push("/admin/videos")}
            className="px-6 py-3 bg-pink-500 text-white font-medium rounded-lg hover:bg-pink-600 transition-colors"
          >
            Back to Videos
          </button>
        </div>
      </div>
    );
  }

  const currentThumbnail = getThumbnailUrl(video as any);
  
  return (
    <div className={`min-h-screen bg-gray-50 ${poppins.className}`}>
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center">
          <button
            onClick={() => router.push("/admin/videos")}
            className="mr-4 flex items-center text-gray-700 hover:text-gray-900 transition-colors font-medium"
          >
            <FaArrowLeft className="mr-2" />
            <span className="text-gray-700">Back to Videos</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            Edit Video
          </h1>
          <span className="ml-3 px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
            {video.storageType === 'cloudinary' ? 'Cloudinary CDN' : 'Local Storage'}
          </span>
        </div>
        
        {saveError && (
          <motion.div
            className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex">
              <div className="flex-shrink-0">
                <FaTimes className="h-5 w-5 text-red-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{saveError}</p>
              </div>
            </div>
          </motion.div>
        )}
        
        {saveSuccess && (
          <motion.div
            className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">Changes saved successfully!</p>
              </div>
            </div>
          </motion.div>
        )}
        
        <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200">
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Video Preview - Left Column */}
              <div className="lg:col-span-5">
                <div className="bg-gray-900 rounded-lg overflow-hidden aspect-[9/16] relative max-w-sm mx-auto">
                  {video && video.id ? (
                    <>
                      {(() => {
                        const allUrls = getVideoUrlsWithFallbacks(video as any);
                        
                        // Filter out HLS (.m3u8) URLs since we don't support them anymore
                        const mp4Urls = allUrls.filter(url => !url.includes('.m3u8') && !url.includes('playlist'));
                        
                        // Use first MP4 URL as primary
                        const videoUrl = mp4Urls[0] || getSafeVideoUrl(video as any);
                        const thumbnailUrl = getThumbnailUrl(video as any);
                        const fallbackSources = mp4Urls.slice(1);
                        
                        return (
                          <video
                            className="w-full h-full object-cover"
                            controls={true}
                            poster={thumbnailUrl}
                            playsInline
                            preload="metadata"
                            onError={(e) => {
                              console.error('[EditPage] Video error:', e);
                              console.error('[EditPage] Video URL:', videoUrl);
                              console.error('[EditPage] Available fallbacks:', fallbackSources);
                              console.error('[EditPage] Video data:', video);
                              console.error('==========================');
                            }}
                            onLoadStart={() => {
                              // Video loading started
                            }}
                            onCanPlay={() => {
                              // Video can play
                            }}
                            onLoadedData={() => {
                              // Video data loaded
                            }}
                          >
                            {/* Primary source */}
                            {videoUrl && <source src={videoUrl} type="video/mp4" />}
                            
                            {/* Fallback sources */}
                            {fallbackSources.map((source, index) => (
                              <source key={index} src={source} type="video/mp4" />
                            ))}
                            
                            Your browser does not support the video tag.
                          </video>
                        );
                      })()}
                      
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800">
                      <div className="text-center text-gray-400">
                        <div className="text-4xl mb-2">🎬</div>
                        <div className="text-sm">Loading video...</div>
                      </div>
                    </div>
                  )}
                  
                  <div className="absolute top-2 left-2">
                    <span className="bg-black/80 text-white text-xs px-2 py-1 rounded-full font-medium">
                      {video?.views || 0} views • {video?.likes || 0} likes
                    </span>
                  </div>
                </div>
                
                {/* Video Info */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{video.title}</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <FaEye className="mr-2 text-blue-500" />
                      <span className="font-medium text-gray-700">{video.views} views</span>
                    </div>
                    <div className="flex items-center">
                      <FaHeart className="mr-2 text-pink-500" />
                      <span className="font-medium text-gray-700">{video.likes} likes</span>
                    </div>
                    <div className="flex items-center">
                      <FaClock className="mr-2 text-gray-500" />
                      <span className="font-medium text-gray-700">
                        {formatSafeDate(video.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Edit Form - Right Column */}
              <div className="lg:col-span-7">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2">
                      Video Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-colors placeholder-gray-500"
                      placeholder="Enter video title"
                      required
                    />
                  </div>
                  
                  {/* Description */}
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2">
                      Description
                    </label>
                    <textarea
                      value={description || ''}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-colors placeholder-gray-500 resize-none"
                      placeholder="Enter video description"
                    />
                  </div>

                  {/* Thumbnail Management */}
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-3">
                      Thumbnail
                    </label>
                    
                    {/* Current Thumbnail */}
                    {currentThumbnail && currentThumbnail.trim() !== '' && !thumbnailPreview && (
                      <div className="mb-4">
                        <div className="relative inline-block">
                          <img
                            src={currentThumbnail}
                            alt="Current thumbnail"
                            className="w-24 rounded-lg border-2 border-gray-300 shadow-sm aspect-[9/16] object-cover"
                          />
                          <button
                            type="button"
                            onClick={deleteThumbnail}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow-sm"
                            title="Delete current thumbnail"
                          >
                            <FaTrash className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-xs font-medium text-gray-600 mt-2">Current thumbnail</p>
                      </div>
                    )}

                    {/* New Thumbnail Preview */}
                    {thumbnailPreview && (
                      <div className="mb-4">
                        <div className="relative inline-block">
                          <img
                            src={thumbnailPreview}
                            alt="New thumbnail preview"
                            className="w-24 rounded-lg border-2 border-green-400 shadow-sm aspect-[9/16] object-cover"
                          />
                          <button
                            type="button"
                            onClick={removeThumbnailPreview}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow-sm"
                            title="Remove new thumbnail"
                          >
                            <FaTimes className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-xs font-medium text-green-700 mt-2">New thumbnail (will be uploaded)</p>
                      </div>
                    )}

                    {/* Upload New Thumbnail */}
                    <div className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-pink-400 transition-colors bg-gray-50 hover:bg-gray-100">
                      <div className="space-y-2 text-center">
                        <FaImage className="mx-auto h-8 w-8 text-gray-500" />
                        <div className="flex text-sm text-gray-700 justify-center">
                          <label
                            htmlFor="thumbnail-upload"
                            className="relative cursor-pointer bg-white rounded-md font-semibold text-pink-600 hover:text-pink-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-pink-500 px-2 py-1"
                          >
                            <span>Upload new thumbnail</span>
                            <input
                              id="thumbnail-upload"
                              name="thumbnail-upload"
                              type="file"
                              ref={thumbnailInputRef}
                              className="sr-only"
                              accept="image/*"
                              onChange={handleThumbnailChange}
                            />
                          </label>
                          <p className="pl-1 text-gray-700">or drag and drop</p>
                        </div>
                        <p className="text-xs font-medium text-gray-600">PNG, JPG, GIF up to 5MB</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => router.push("/admin/videos")}
                      className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving || isUploadingThumbnail}
                      className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-medium rounded-lg hover:from-pink-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center shadow-sm"
                    >
                      {isSaving || isUploadingThumbnail ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="text-white font-medium">
                            {isUploadingThumbnail ? 'Uploading...' : 'Saving...'}
                          </span>
                        </>
                      ) : (
                        <>
                          <FaSave className="mr-2" />
                          <span className="text-white font-medium">Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 