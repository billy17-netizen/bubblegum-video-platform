"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaUpload, FaArrowLeft, FaTrash, FaCheck, FaTimes, FaMagic } from "react-icons/fa";
import { generateThumbnailFromVideo, blobToFile, generateThumbnailFilename } from "@/lib/autoThumbnail";

interface UploadItem {
  id: string;
  videoFile: File;
  thumbnailFile: File | null;
  autoThumbnailBlob: Blob | null; // For client-side generated thumbnails
  title: string;
  description: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  progress?: number;
}

export default function BulkUpload() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [storageType, setStorageType] = useState<'local' | 'cloudinary' | 'bunny'>('local');
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [autoGenerateThumbnails, setAutoGenerateThumbnails] = useState(true);
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.push("/");
    }
  }, [status, session, router]);

  const handleVideoFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    const newItems: UploadItem[] = files.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      videoFile: file,
      thumbnailFile: null,
      autoThumbnailBlob: null,
      title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
      description: "",
      status: 'pending'
    }));

    setUploadItems(prev => [...prev, ...newItems]);
    
    // Auto generate thumbnails if enabled
    if (autoGenerateThumbnails && newItems.length > 0) {
      await generateThumbnailsForItems(newItems);
    }
  };

  const generateThumbnailsForItems = async (items: UploadItem[]) => {
    setIsGeneratingThumbnails(true);
    
    for (const item of items) {
      try {
        console.log(`Generating thumbnail for: ${item.videoFile.name}`);
        const thumbnailBlob = await generateThumbnailFromVideo(item.videoFile, 10);
        
        if (thumbnailBlob) {
          setUploadItems(prev => 
            prev.map(i => 
              i.id === item.id 
                ? { ...i, autoThumbnailBlob: thumbnailBlob }
                : i
            )
          );
          console.log(`Thumbnail generated for: ${item.videoFile.name}`);
        }
      } catch (error) {
        console.error(`Failed to generate thumbnail for ${item.videoFile.name}:`, error);
      }
      
      // Small delay between generations to prevent browser freeze
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setIsGeneratingThumbnails(false);
  };

  const regenerateThumbnailForItem = async (itemId: string) => {
    const item = uploadItems.find(i => i.id === itemId);
    if (!item) return;
    
    setIsGeneratingThumbnails(true);
    
    try {
      const thumbnailBlob = await generateThumbnailFromVideo(item.videoFile, 10);
      
      if (thumbnailBlob) {
        setUploadItems(prev => 
          prev.map(i => 
            i.id === itemId 
              ? { ...i, autoThumbnailBlob: thumbnailBlob }
              : i
          )
        );
      }
    } catch (error) {
      console.error(`Failed to regenerate thumbnail:`, error);
    }
    
    setIsGeneratingThumbnails(false);
  };

  const handleThumbnailChange = (itemId: string, file: File | null) => {
    setUploadItems(prev => 
      prev.map(item => 
        item.id === itemId ? { ...item, thumbnailFile: file } : item
      )
    );
  };

  const updateItemField = (itemId: string, field: 'title' | 'description', value: string) => {
    setUploadItems(prev => 
      prev.map(item => 
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );
  };

  const removeItem = (itemId: string) => {
    setUploadItems(prev => prev.filter(item => item.id !== itemId));
  };

  const uploadSingleItem = async (item: UploadItem) => {
    const apiEndpoint = getApiEndpoint();
    
    const formData = new FormData();
    formData.append("title", item.title);
    formData.append("description", item.description);
    formData.append("video", item.videoFile);
    
    // Use manual thumbnail if provided, otherwise use auto-generated thumbnail
    if (item.thumbnailFile) {
      formData.append("thumbnail", item.thumbnailFile);
    } else if (item.autoThumbnailBlob) {
      const thumbnailFile = blobToFile(
        item.autoThumbnailBlob, 
        generateThumbnailFilename(item.videoFile.name)
      );
      formData.append("thumbnail", thumbnailFile);
    }

    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  };

  const getApiEndpoint = () => {
    switch (storageType) {
      case 'cloudinary':
        return "/api/admin/upload-video-cloudinary";
      case 'bunny':
        return "/api/admin/upload-video-bunny";
      default:
        return "/api/admin/upload-video";
    }
  };

  const handleBulkUpload = async () => {
    if (uploadItems.length === 0) return;
    
    setIsUploading(true);

    for (const item of uploadItems) {
      if (item.status !== 'pending') continue;

      try {
        // Update status to uploading
        setUploadItems(prev => 
          prev.map(i => 
            i.id === item.id ? { ...i, status: 'uploading' } : i
          )
        );

        await uploadSingleItem(item);

        // Update status to success
        setUploadItems(prev => 
          prev.map(i => 
            i.id === item.id ? { ...i, status: 'success' } : i
          )
        );

        // Small delay between uploads
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        // Update status to error
        setUploadItems(prev => 
          prev.map(i => 
            i.id === item.id ? { 
              ...i, 
              status: 'error', 
              error: error instanceof Error ? error.message : 'Upload failed'
            } : i
          )
        );
      }
    }

    setIsUploading(false);
  };

  const getStorageDisplayName = () => {
    switch (storageType) {
      case 'cloudinary': return 'Cloudinary CDN';
      case 'bunny': return 'Bunny.net';
      default: return 'Local Storage';
    }
  };

  if (status === "loading") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.push("/admin")}
                className="flex items-center text-gray-600 hover:text-pink-500 transition-colors"
              >
                <FaArrowLeft className="mr-2" />
                <span className="font-medium">Back to Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="px-6 py-8">
            <div className="mb-8">
              <h3 className="text-2xl leading-8 font-bold text-gray-900 mb-2">
                Bulk Video Upload
              </h3>
              <p className="text-base text-gray-600">
                Upload multiple videos at once to {getStorageDisplayName()}.
              </p>
            </div>

            {/* Storage Selection */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-800 mb-3">
                Storage Type
              </label>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {[
                  { value: 'local', label: 'Local Storage', description: 'Server storage' },
                  { value: 'cloudinary', label: 'Cloudinary CDN', description: 'Recommended' },
                  { value: 'bunny', label: 'Bunny.net', description: 'Premium CDN' }
                ].map((option) => (
                  <label key={option.value} className="relative">
                    <input
                      type="radio"
                      checked={storageType === option.value}
                      onChange={() => setStorageType(option.value as 'local' | 'cloudinary' | 'bunny')}
                      disabled={isUploading}
                      className="sr-only"
                    />
                    <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      storageType === option.value
                        ? 'border-pink-500 bg-pink-50'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${isUploading || isGeneratingThumbnails ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <div className="font-medium text-gray-900">{option.label}</div>
                      <div className="text-sm text-gray-600">{option.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Video Selection */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Select Videos
              </label>
              
              {/* Auto Thumbnail Toggle */}
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FaMagic className="text-blue-500" />
                    <div>
                      <h4 className="text-sm font-semibold text-blue-800">Auto Generate Thumbnails</h4>
                      <p className="text-xs text-blue-600">
                        Otomatis membuat thumbnail dari frame video (detik ke-10)
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoGenerateThumbnails}
                      onChange={(e) => setAutoGenerateThumbnails(e.target.checked)}
                      disabled={isUploading || isGeneratingThumbnails}
                      className="sr-only"
                    />
                    <div className={`w-11 h-6 rounded-full transition-colors ${
                      autoGenerateThumbnails ? 'bg-blue-500' : 'bg-gray-300'
                    } ${isUploading || isGeneratingThumbnails ? 'opacity-50' : ''}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                        autoGenerateThumbnails ? 'translate-x-5' : 'translate-x-0'
                      } mt-0.5 ml-0.5`}></div>
                    </div>
                  </label>
                </div>
                
                {isGeneratingThumbnails && (
                  <div className="mt-3 flex items-center space-x-2 text-sm text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                    <span>Generating thumbnails...</span>
                  </div>
                )}
              </div>
              
              <div className="mt-1 flex justify-center px-6 pt-8 pb-8 border-2 border-gray-300 border-dashed rounded-lg hover:border-pink-400 transition-colors">
                <div className="space-y-2 text-center">
                  <FaUpload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <div className="flex text-base text-gray-600 justify-center">
                    <label
                      htmlFor="video-upload"
                      className={`relative rounded-md font-semibold px-2 ${
                        isUploading 
                          ? 'cursor-not-allowed text-gray-400 bg-gray-100' 
                          : 'cursor-pointer bg-white text-pink-600 hover:text-pink-500'
                      }`}
                    >
                      <span>Select multiple video files</span>
                      <input
                        id="video-upload"
                        name="video-upload"
                        type="file"
                        ref={videoInputRef}
                        className="sr-only"
                        accept="video/*"
                        multiple
                        onChange={handleVideoFilesChange}
                        disabled={isUploading}
                      />
                    </label>
                  </div>
                  <p className="text-sm text-gray-500 font-medium">
                    MP4, WebM, or Ogg files
                  </p>
                </div>
              </div>
            </div>

            {/* Upload Items List */}
            {uploadItems.length > 0 && (
              <div className="mb-8">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">
                  Upload Queue ({uploadItems.length} items)
                </h4>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {uploadItems.map((item) => (
                    <div key={item.id} className="border rounded-lg p-4 bg-white shadow-sm">
                      <div className="flex items-start space-x-4">
                        {/* Status Icon */}
                        <div className="flex-shrink-0 mt-1">
                          {item.status === 'pending' && <div className="w-4 h-4 rounded-full bg-gray-400"></div>}
                          {item.status === 'uploading' && <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse"></div>}
                          {item.status === 'success' && <FaCheck className="w-4 h-4 text-green-600" />}
                          {item.status === 'error' && <FaTimes className="w-4 h-4 text-red-600" />}
                        </div>

                        {/* Thumbnail Preview */}
                        <div className="flex-shrink-0">
                          <div className="w-24 h-16 bg-gray-200 rounded-md overflow-hidden">
                            {(item.thumbnailFile || item.autoThumbnailBlob) ? (
                              <img 
                                src={item.thumbnailFile 
                                  ? URL.createObjectURL(item.thumbnailFile)
                                  : URL.createObjectURL(item.autoThumbnailBlob!)
                                } 
                                alt="Thumbnail"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <FaUpload className="w-6 h-6" />
                              </div>
                            )}
                          </div>
                          
                          {/* Regenerate Thumbnail Button */}
                          {autoGenerateThumbnails && !item.thumbnailFile && (
                            <button
                              onClick={() => regenerateThumbnailForItem(item.id)}
                              disabled={isGeneratingThumbnails || isUploading || item.status === 'success'}
                              className="mt-1 w-24 px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              title="Regenerate thumbnail"
                            >
                              <FaMagic className="inline w-3 h-3 mr-1" />
                              Regen
                            </button>
                          )}
                        </div>

                        {/* Video Info */}
                        <div className="flex-1 min-w-0">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-gray-800 mb-1">
                                Title
                              </label>
                              <input
                                type="text"
                                value={item.title}
                                onChange={(e) => updateItemField(item.id, 'title', e.target.value)}
                                disabled={isUploading || item.status === 'success'}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 disabled:bg-gray-100 disabled:text-gray-600"
                                placeholder="Video title"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-800 mb-1">
                                Description
                              </label>
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => updateItemField(item.id, 'description', e.target.value)}
                                disabled={isUploading || item.status === 'success'}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 disabled:bg-gray-100 disabled:text-gray-600"
                                placeholder="Video description"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-800 mb-1">
                                Thumbnail (Optional)
                              </label>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleThumbnailChange(item.id, e.target.files?.[0] || null)}
                                disabled={isUploading || item.status === 'success'}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 disabled:bg-gray-100 disabled:text-gray-600"
                              />
                            </div>
                          </div>
                          
                          {item.status === 'error' && (
                            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md">
                              <div className="text-sm font-medium text-red-800">
                                Error: {item.error}
                              </div>
                            </div>
                          )}
                          
                          <div className="mt-3 text-sm text-gray-700 bg-gray-50 p-2 rounded-md">
                            <span className="font-medium">Video:</span> {item.videoFile.name} ({(item.videoFile.size / 1024 / 1024).toFixed(2)} MB)
                            {item.thumbnailFile ? (
                              <span className="block mt-1 text-green-600">
                                <span className="font-medium">Manual Thumbnail:</span> {item.thumbnailFile.name}
                              </span>
                            ) : item.autoThumbnailBlob ? (
                              <span className="block mt-1 text-blue-600">
                                <span className="font-medium">Auto Thumbnail:</span> Generated from video
                              </span>
                            ) : autoGenerateThumbnails ? (
                              <span className="block mt-1 text-amber-600">
                                <span className="font-medium">Thumbnail:</span> Generating...
                              </span>
                            ) : (
                              <span className="block mt-1 text-gray-500">
                                <span className="font-medium">Thumbnail:</span> None
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Remove Button */}
                        <button
                          onClick={() => removeItem(item.id)}
                          disabled={isUploading || item.status === 'uploading'}
                          className="flex-shrink-0 p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                          title="Remove item"
                        >
                          <FaTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => router.push("/admin")}
                className="px-6 py-3 border border-gray-300 rounded-lg shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpload}
                disabled={uploadItems.length === 0 || isUploading}
                className="px-8 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isUploading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </div>
                ) : (
                  `Start Bulk Upload (${uploadItems.filter(item => item.status === 'pending').length})`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 