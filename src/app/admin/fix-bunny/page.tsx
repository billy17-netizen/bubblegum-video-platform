'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

export default function FixBunnyPage() {
  const { data: session, status } = useSession();
  const [videoId, setVideoId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (status === 'loading') return <div>Loading...</div>;
  if (!session || session.user?.role !== 'ADMIN') {
    redirect('/admin/login');
  }

  const handleFixVideo = async () => {
    if (!videoId.trim()) {
      setError('Please enter a video ID');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/admin/bunny-reupload/${videoId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fix video');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Fix Failed Bunny.net Videos</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Video Cleanup Tool</h2>
          <p className="text-gray-600 mb-6">
            This tool will delete a failed video from Bunny.net and reset it for re-upload.
            Use this when you see "NS_BINDING_ABORTED" or "Video processing failed" errors.
          </p>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="videoId" className="block text-sm font-medium text-gray-700 mb-2">
                Video ID
              </label>
              <input
                type="text"
                id="videoId"
                value={videoId}
                onChange={(e) => setVideoId(e.target.value)}
                placeholder="aed512b7-4fc9-4b88-a6bd-7c5415c550df"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <button
              onClick={handleFixVideo}
              disabled={loading}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Fix Video'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-semibold text-green-800 mb-2">Success</h3>
            <p className="text-green-700 mb-4">{result.message}</p>
            
            <div className="bg-white rounded p-4 border">
              <h4 className="font-medium text-gray-800 mb-2">Video Details:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><strong>ID:</strong> {result.video.id}</li>
                <li><strong>Title:</strong> {result.video.title}</li>
                <li><strong>Storage:</strong> {result.video.storageType}</li>
              </ul>
            </div>
            
            <div className="mt-4 p-4 bg-blue-50 rounded">
              <h4 className="font-medium text-blue-800 mb-2">Next Steps:</h4>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>Go to the Admin Upload page</li>
                <li>Upload a new video file</li>
                <li>The video will be re-uploaded to Bunny.net with a fresh ID</li>
              </ol>
            </div>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Current Failed Video</h3>
          <p className="text-yellow-700 mb-2">
            Video ID: <code className="bg-yellow-100 px-2 py-1 rounded">aed512b7-4fc9-4b88-a6bd-7c5415c550df</code>
          </p>
          <p className="text-yellow-700 mb-2">
            Bunny Video ID: <code className="bg-yellow-100 px-2 py-1 rounded">b1505e04-dd52-4642-a7f3-54c9e4d21822</code>
          </p>
          <p className="text-yellow-700 text-sm">
            This video failed processing and all CDN URLs return 404 errors.
          </p>
          
          <button
            onClick={() => setVideoId('aed512b7-4fc9-4b88-a6bd-7c5415c550df')}
            className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
          >
            Fix This Video
          </button>
        </div>
      </div>
    </div>
  );
} 