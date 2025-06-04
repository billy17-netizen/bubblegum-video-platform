'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function UploadBunnyPage() {
  const { data: session } = useSession();
  const router = useRouter();
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'thumbnail') => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'video') {
        setVideoFile(file);
      } else {
        setThumbnailFile(file);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !videoFile) {
      setError('Title and video file are required');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('video', videoFile);
      if (thumbnailFile) {
        formData.append('thumbnail', thumbnailFile);
      }

      const response = await fetch('/api/admin/upload-video-bunny', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setUploadResult(result);
        setUploadProgress(100);
        // Reset form
        setTitle('');
        setDescription('');
        setVideoFile(null);
        setThumbnailFile(null);
        // Reset file inputs
        const videoInput = document.getElementById('video-file') as HTMLInputElement;
        const thumbnailInput = document.getElementById('thumbnail-file') as HTMLInputElement;
        if (videoInput) videoInput.value = '';
        if (thumbnailInput) thumbnailInput.value = '';
      } else {
        setError(result.message || 'Upload failed');
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">Please log in to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Upload Video to Bunny.net</h1>
              <p className="mt-2 text-gray-600">
                Upload videos to Bunny.net CDN for high-performance streaming with global distribution.
              </p>
            </div>
            <button
              onClick={() => router.back()}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Upload Form */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-semibold text-gray-800 mb-2">
                Video Title *
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter video title"
                className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition-colors placeholder-gray-400 disabled:bg-gray-50 disabled:text-gray-700 disabled:border-gray-200"
                required
                disabled={isUploading}
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-gray-800 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter video description (optional)"
                rows={3}
                className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition-colors placeholder-gray-400 disabled:bg-gray-50 disabled:text-gray-700 disabled:border-gray-200 resize-none"
                disabled={isUploading}
              />
            </div>

            {/* Video File */}
            <div>
              <label htmlFor="video-file" className="block text-sm font-semibold text-gray-800 mb-2">
                Video File *
              </label>
              <div className="relative">
                <input
                  id="video-file"
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleFileChange(e, 'video')}
                  className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-100 file:text-orange-800 file:font-medium file:cursor-pointer hover:file:bg-orange-200 disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-200"
                  required
                  disabled={isUploading}
                />
              </div>
              {videoFile && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-800">
                    ✅ Selected: <span className="font-semibold">{videoFile.name}</span>
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Size: {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
              <p className="mt-2 text-xs font-medium text-gray-600">
                📁 Supported formats: MP4, WebM, MOV, AVI • Max size: 5GB
              </p>
            </div>

            {/* Thumbnail File */}
            <div>
              <label htmlFor="thumbnail-file" className="block text-sm font-semibold text-gray-800 mb-2">
                Thumbnail Image (Optional)
              </label>
              <div className="relative">
                <input
                  id="thumbnail-file"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'thumbnail')}
                  className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-100 file:text-blue-800 file:font-medium file:cursor-pointer hover:file:bg-blue-200 disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-200"
                  disabled={isUploading}
                />
              </div>
              {thumbnailFile && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800">
                    🖼️ Selected: <span className="font-semibold">{thumbnailFile.name}</span>
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Size: {(thumbnailFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs font-medium text-yellow-800">
                  💡 <strong>Auto-Thumbnail:</strong> If no thumbnail is provided, we'll automatically generate one from your video.
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={isUploading || !title || !videoFile}
                className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-200 flex items-center shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:shadow-none"
              >
                {isUploading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="font-semibold">Uploading to Bunny.net...</span>
                  </>
                ) : (
                  <>
                    <span>Upload to Bunny.net</span>
                    <span className="ml-2 text-xl">🐰</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Progress Bar */}
        {isUploading && (
          <div className="mt-6 bg-white rounded-lg shadow-lg p-6 border-l-4 border-orange-500">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-orange-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Upload Progress
            </h3>
            <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
              <div
                className="bg-gradient-to-r from-orange-500 to-red-500 h-4 rounded-full transition-all duration-300 flex items-center justify-center"
                style={{ width: `${uploadProgress}%` }}
              >
                {uploadProgress > 10 && (
                  <span className="text-white text-xs font-semibold">
                    {uploadProgress.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm font-medium text-gray-700">
              🚀 Uploading to Bunny.net CDN... This may take a few minutes for large files.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Your video is being processed and will be available worldwide through Bunny.net's global CDN.
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-6 bg-red-50 border-l-4 border-red-400 rounded-lg p-6 shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-bold text-red-900">❌ Upload Failed</h3>
                <p className="mt-2 text-sm font-medium text-red-800 bg-white p-3 rounded border border-red-200">
                  {error}
                </p>
                <p className="mt-2 text-xs text-red-700">
                  Please check your internet connection and try again. If the problem persists, contact support.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success Display */}
        {uploadResult && uploadResult.success && (
          <div className="mt-6 bg-green-50 border-l-4 border-green-400 rounded-lg p-6 shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-bold text-green-900">🎉 Upload Successful!</h3>
                <p className="mt-2 text-sm font-medium text-green-800">{uploadResult.message}</p>
                
                {/* Upload Details */}
                <div className="mt-4 bg-white p-4 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-900 mb-3">📋 Upload Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Video ID:</span>
                      <span className="text-gray-900 font-mono bg-gray-100 px-2 py-1 rounded text-xs">
                        {uploadResult.uploadDetails?.videoId}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Provider:</span>
                      <span className="text-blue-700 font-semibold">🐰 Bunny.net CDN</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">File Size:</span>
                      <span className="text-gray-900 font-semibold">
                        {uploadResult.uploadDetails?.fileSize 
                          ? (uploadResult.uploadDetails.fileSize / 1024 / 1024).toFixed(2) + ' MB' 
                          : 'Unknown'
                        }
                      </span>
                    </div>
                    {uploadResult.uploadDetails?.thumbnailSource && (
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-700">Thumbnail:</span>
                        <span className="text-green-700 font-semibold capitalize">
                          {uploadResult.uploadDetails.thumbnailSource}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="mt-4 flex space-x-3">
                  <button
                    onClick={() => router.push('/admin/videos')}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    View All Videos
                  </button>
                  <button
                    onClick={() => {
                      setUploadResult(null);
                      setError(null);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Upload Another Video
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center">
            <span className="mr-2 text-xl">🐰</span>
            About Bunny.net Upload
          </h3>
          <div className="space-y-4 text-sm">
            <div className="flex items-start">
              <span className="font-bold text-lg mr-3 text-blue-600">🌍</span>
              <div>
                <p className="font-semibold text-blue-900">Global CDN</p>
                <p className="text-blue-700">Videos are distributed worldwide for fast streaming</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="font-bold text-lg mr-3 text-blue-600">⚡</span>
              <div>
                <p className="font-semibold text-blue-900">High Performance</p>
                <p className="text-blue-700">Optimized for video streaming with adaptive quality</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="font-bold text-lg mr-3 text-blue-600">💾</span>
              <div>
                <p className="font-semibold text-blue-900">Large Files</p>
                <p className="text-blue-700">Supports videos up to <strong>5GB</strong> (much larger than Cloudinary's 100MB limit)</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="font-bold text-lg mr-3 text-blue-600">🎬</span>
              <div>
                <p className="font-semibold text-blue-900">Auto Thumbnails</p>
                <p className="text-blue-700">Automatic thumbnail generation if not provided</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="font-bold text-lg mr-3 text-blue-600">🔄</span>
              <div>
                <p className="font-semibold text-blue-900">Reliability</p>
                <p className="text-blue-700">Built-in retry logic and timeout handling</p>
              </div>
            </div>
          </div>
          
          {/* Performance Comparison */}
          <div className="mt-6 p-4 bg-white rounded-lg border border-blue-200">
            <h4 className="font-bold text-blue-900 mb-3">📊 Bunny.net vs Cloudinary</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-semibold text-gray-800">🐰 Bunny.net</p>
                <ul className="text-green-700 space-y-1 mt-1">
                  <li>✅ File size: Up to 5GB</li>
                  <li>✅ Global CDN included</li>
                  <li>✅ HLS streaming</li>
                  <li>✅ Cost-effective pricing</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-gray-800">☁️ Cloudinary</p>
                <ul className="text-red-700 space-y-1 mt-1">
                  <li>❌ File size: Max 100MB</li>
                  <li>❌ Account suspended</li>
                  <li>❌ Higher costs</li>
                  <li>❌ Limited free tier</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 