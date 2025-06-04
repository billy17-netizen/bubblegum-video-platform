'use client';

import { useState } from 'react';
import BunnyVideoPlayer from '@/components/BunnyVideoPlayer';

export default function TestVideoPage() {
  const [testVideo] = useState({
    id: 'aed512b7-4fc9-4b88-a6bd-7c5415c550df',
    title: 'Test Video',
    description: 'Testing Bunny.net video with fallback',
    filePath: 'https://bubblegum-cdn.b-cdn.net/b1505e04-dd52-4642-a7f3-54c9e4d21822/playlist.m3u8',
    thumbnail: null,
    cloudinaryPublicId: null,
    cloudinaryUrl: null,
    thumbnailPublicId: null,
    thumbnailUrl: null,
    bunnyVideoId: 'b1505e04-dd52-4642-a7f3-54c9e4d21822',
    bunnyStreamUrl: 'https://bubblegum-cdn.b-cdn.net/b1505e04-dd52-4642-a7f3-54c9e4d21822/playlist.m3u8',
    bunnyThumbnailUrl: null,
    googleDriveFileId: null,
    googleDriveVideoUrl: null,
    googleDriveThumbnailId: null,
    googleDriveThumbnailUrl: null,
    likes: 0,
    views: 0,
    createdAt: new Date().toISOString(),
    admin: { username: 'admin' }
  });

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Video Player Test</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Enhanced Bunny.net Video Player</h2>
          <p className="text-gray-600 mb-4">
            This player automatically falls back to HLS streaming when MP4 processing fails.
          </p>
          
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <BunnyVideoPlayer 
              video={testVideo}
              className="w-full h-full"
              controls={true}
              poster="https://bubblegum-cdn.b-cdn.net/b1505e04-dd52-4642-a7f3-54c9e4d21822/0.jpg"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Video Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Video ID:</span>
              <span className="ml-2 text-gray-600">{testVideo.bunnyVideoId}</span>
            </div>
            <div>
              <span className="font-medium">Storage:</span>
              <span className="ml-2 text-gray-600">Bunny.net CDN</span>
            </div>
            <div>
              <span className="font-medium">MP4 URL:</span>
              <span className="ml-2 text-gray-600 break-all">
                https://bubblegum-cdn.b-cdn.net/{testVideo.bunnyVideoId}/play_720p.mp4
              </span>
            </div>
            <div>
              <span className="font-medium">HLS URL:</span>
              <span className="ml-2 text-gray-600 break-all">
                {testVideo.bunnyStreamUrl}
              </span>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>How it works:</strong> The player first tries to load the MP4 file. If that fails (404 error), 
              it automatically switches to the HLS stream which should work even when MP4 processing failed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 