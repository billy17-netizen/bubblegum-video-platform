"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaUpload, FaArrowLeft } from "react-icons/fa";

export default function UploadVideo() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [storageType, setStorageType] = useState<'local' | 'cloudinary' | 'bunny'>('local'); // Default to Local storage
  
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.push("/");
    }
  }, [status, session, router]);

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!title || !videoFile) {
      setError("Title and video are required");
      return;
    }

    // Prevent double submission
    if (isUploading) {
      console.log("[Frontend] Upload already in progress, ignoring duplicate submission");
      return;
    }

    setIsUploading(true);

    // Determine storage type and API endpoint
    let apiEndpoint: string;
    let storageDisplayName: string;
    
    switch (storageType) {
      case 'cloudinary':
        apiEndpoint = "/api/admin/upload-video-cloudinary";
        storageDisplayName = 'Cloudinary';
        break;
      case 'bunny':
        apiEndpoint = "/api/admin/upload-video-bunny";
        storageDisplayName = 'Bunny.net';
        break;
      default:
        apiEndpoint = "/api/admin/upload-video";
        storageDisplayName = 'Local';
        break;
    }

    try {
      console.log(`[Frontend] Starting upload process...`);
      console.log(`[Frontend] Video file:`, {
        name: videoFile.name,
        size: videoFile.size,
        type: videoFile.type
      });
      
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("video", videoFile);
      if (thumbnailFile) {
        formData.append("thumbnail", thumbnailFile);
        console.log(`[Frontend] Thumbnail file:`, {
          name: thumbnailFile.name,
          size: thumbnailFile.size,
          type: thumbnailFile.type
        });
      }

      console.log(`[Frontend] Uploading to: ${apiEndpoint} (${storageDisplayName})`);

      const response = await fetch(apiEndpoint, {
        method: "POST",
        body: formData,
      });

      console.log(`[Frontend] Response status: ${response.status}`);
      console.log(`[Frontend] Response ok: ${response.ok}`);

      if (!response.ok) {
        let errorMessage = `Upload failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          console.error(`[Frontend] Error response:`, errorData);
          errorMessage = errorData.error || errorData.details || errorMessage;
          
          // Provide specific guidance based on error type
          if (response.status === 401) {
            errorMessage = "Authentication failed. Please refresh the page and try again.";
          } else if (response.status === 413) {
            errorMessage = "File too large. Please try a smaller video file.";
          } else if (response.status === 409) {
            errorMessage = "A video with this title already exists. Please choose a different title.";
          } else if (response.status === 400 && errorData.error?.includes("Cloudinary configuration")) {
            // Special handling for Cloudinary config missing
            errorMessage = `${errorData.error}\n\n${errorData.details}\n\nMissing: ${errorData.missingVars?.join(', ')}\n\n💡 ${errorData.suggestion}`;
          } else if (response.status === 500) {
            errorMessage = `Server error: ${errorData.details || errorData.error || "Internal server error"}. Check the console for more details.`;
          }
        } catch (parseError) {
          console.error(`[Frontend] Failed to parse error response:`, parseError);
          errorMessage = `Upload failed with status ${response.status}. Server response could not be parsed.`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log(`[Frontend] Upload successful:`, result);

      setSuccess(true);
      
      // Tampilkan pesan sukses yang berbeda berdasarkan info thumbnail
      let successMessage = "Video berhasil diupload!";
      if (result.thumbnailInfo) {
        if (result.thumbnailInfo.wasAutoGenerated) {
          successMessage += " Thumbnail otomatis dibuat dari video.";
        } else if (result.thumbnailInfo.wasProvided) {
          successMessage += " Thumbnail yang Anda upload berhasil disimpan.";
        }
      }
      
      // Update success state dengan pesan custom jika perlu
      // atau bisa menggunakan state terpisah untuk pesan
      console.log(`[Frontend] ${successMessage}`);
      
      // Reset form
      setTitle("");
      setDescription("");
      setVideoFile(null);
      setThumbnailFile(null);
      setVideoPreview(null);
      setThumbnailPreview(null);
      if (videoInputRef.current) videoInputRef.current.value = "";
      if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";

    } catch (error) {
      console.error("[Frontend] Upload error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to upload video";
      setError(errorMessage);
      
      // Also log to help with debugging
      console.error("[Frontend] Full error details:", {
        message: errorMessage,
        error: error,
        storageType: storageDisplayName,
        videoFile: videoFile ? { name: videoFile.name, size: videoFile.size } : null
      });
      
    } finally {
      setIsUploading(false);
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

      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="px-6 py-8 sm:p-10">
            <div className="mb-8">
              <h3 className="text-2xl leading-8 font-bold text-gray-900 mb-2">
                Upload New Video
              </h3>
              <p className="text-base text-gray-600">
                Fill in the details and upload your video file to share with the community.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Title Field */}
              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-semibold text-gray-800 mb-2"
                >
                  Video Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isUploading}
                  className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-3 px-4 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Enter a catchy title for your video"
                  required
                />
              </div>

              {/* Description Field */}
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-semibold text-gray-800 mb-2"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isUploading}
                  rows={4}
                  className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-3 px-4 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Describe your video content..."
                />
              </div>

              {/* Storage Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  Storage Type
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={storageType === 'cloudinary'}
                      onChange={() => setStorageType('cloudinary')}
                      disabled={isUploading}
                      className="form-radio h-4 w-4 text-pink-600 focus:ring-pink-500 disabled:opacity-50"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">
                      Cloudinary CDN (Recommended)
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={storageType === 'bunny'}
                      onChange={() => setStorageType('bunny')}
                      disabled={isUploading}
                      className="form-radio h-4 w-4 text-pink-600 focus:ring-pink-500 disabled:opacity-50"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">
                      Bunny.net (5GB)
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={storageType === 'local'}
                      onChange={() => setStorageType('local')}
                      disabled={isUploading}
                      className="form-radio h-4 w-4 text-pink-600 focus:ring-pink-500 disabled:opacity-50"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">
                      Local Storage
                    </span>
                  </label>
                </div>
                
                {/* Warning for Cloudinary */}
                {storageType === 'cloudinary' && (
                  <div className="mt-3 bg-amber-50 border-l-4 border-amber-400 p-3">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-amber-700">
                          <strong>Cloudinary Setup Required:</strong> Pastikan Anda sudah mengatur CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, dan CLOUDINARY_API_SECRET di file .env. 
                          <br />
                          <span className="mt-1 inline-block text-amber-600">
                            💡 Gunakan <strong>"Local Storage"</strong> untuk testing cepat tanpa setup tambahan.
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Info for Bunny.net */}
                {storageType === 'bunny' && (
                  <div className="mt-3 bg-purple-50 border-l-4 border-purple-400 p-3">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-purple-700">
                          <strong>🎬 Bunny.net Stream (Premium):</strong> Mendukung file hingga <strong>5GB</strong> dengan streaming HLS, auto-transcoding ke multiple resolutions, dan CDN global. 
                          <br />
                          <span className="mt-1 inline-block text-purple-600">
                            ⚙️ Requires: BUNNY_API_KEY, BUNNY_LIBRARY_ID, BUNNY_STORAGE_API_KEY di .env
                          </span>
                          <br />
                          <span className="mt-1 inline-block text-purple-600">
                            ✨ Features: Auto thumbnail generation, HLS streaming, MP4 fallback
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Info for Local Storage */}
                {storageType === 'local' && (
                  <div className="mt-3 bg-green-50 border-l-4 border-green-400 p-3">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-green-700">
                          <strong>Ready to use!</strong> Local storage tidak memerlukan setup tambahan. File akan disimpan di server lokal dan thumbnail akan otomatis dibuat.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Video Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Video File <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 flex justify-center px-6 pt-8 pb-8 border-2 border-gray-300 border-dashed rounded-lg hover:border-pink-400 transition-colors">
                  <div className="space-y-2 text-center">
                    {videoPreview ? (
                      <div className="mb-4">
                        <video
                          src={videoPreview}
                          controls
                          className="mx-auto h-48 w-auto rounded-lg shadow-md"
                        />
                        <p className="mt-2 text-sm font-medium text-gray-700">
                          {videoFile?.name}
                        </p>
                      </div>
                    ) : (
                      <FaUpload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    )}
                    <div className="flex text-base text-gray-600 justify-center">
                      <label
                        htmlFor="video-upload"
                        className={`relative rounded-md font-semibold px-2 ${
                          isUploading 
                            ? 'cursor-not-allowed text-gray-400 bg-gray-100' 
                            : 'cursor-pointer bg-white text-pink-600 hover:text-pink-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-pink-500'
                        }`}
                      >
                        <span>{isUploading ? 'Uploading...' : 'Upload a video file'}</span>
                        <input
                          id="video-upload"
                          name="video-upload"
                          type="file"
                          ref={videoInputRef}
                          className="sr-only"
                          accept="video/*"
                          onChange={handleVideoChange}
                          disabled={isUploading}
                          required
                        />
                      </label>
                      <p className="pl-1 text-gray-600">or drag and drop</p>
                    </div>
                    <p className="text-sm text-gray-500 font-medium">
                      {storageType === 'bunny' 
                        ? 'MP4, WebM, or Ogg files up to 5GB' 
                        : 'MP4, WebM, or Ogg files up to 100MB'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Thumbnail Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Video Thumbnail (Optional)
                </label>
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-blue-700">
                        <strong>Manual Upload:</strong> Upload video dan thumbnail secara manual untuk kontrol penuh.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-pink-400 transition-colors">
                  <div className="space-y-2 text-center">
                    {thumbnailPreview ? (
                      <div className="mb-4">
                        <img
                          src={thumbnailPreview}
                          alt="Thumbnail preview"
                          className="mx-auto h-48 w-auto rounded-lg shadow-md"
                        />
                        <p className="mt-2 text-sm font-medium text-gray-700">
                          {thumbnailFile?.name}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <FaUpload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <div className="text-gray-600">
                          <p className="text-sm font-medium">Upload thumbnail (opsional)</p>
                          <p className="text-xs text-gray-500 mt-1">atau biarkan kosong untuk auto-generate</p>
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <label
                        htmlFor="thumbnail-upload"
                        className={`relative rounded-md font-semibold px-2 ${
                          isUploading 
                            ? 'cursor-not-allowed text-gray-400 bg-gray-100' 
                            : 'cursor-pointer bg-white text-pink-600 hover:text-pink-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-pink-500'
                        }`}
                      >
                        <span>{isUploading ? 'Uploading...' : 'Select thumbnail image'}</span>
                        <input
                          id="thumbnail-upload"
                          name="thumbnail-upload"
                          type="file"
                          ref={thumbnailInputRef}
                          className="sr-only"
                          accept="image/*"
                          onChange={handleThumbnailChange}
                          disabled={isUploading}
                        />
                      </label>
                      <p className="pl-1 text-gray-600">or drag and drop</p>
                    </div>
                    <p className="text-sm text-gray-500 font-medium">
                      PNG, JPG, or WebP files up to 5MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414-1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-semibold text-red-800">
                        Upload Error
                      </h3>
                      <div className="mt-1 text-sm text-red-700">
                        <p>{error}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-semibold text-green-800">
                        Upload Successful!
                      </h3>
                      <div className="mt-1 text-sm text-green-700">
                        <p>Your video has been uploaded successfully and is now available on the platform.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => router.push("/admin")}
                  className="px-6 py-3 border border-gray-300 rounded-lg shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
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
                    "Upload Video"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 