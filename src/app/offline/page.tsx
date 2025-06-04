'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-3xl font-bold mb-4">You're Offline</h1>
        <p className="text-gray-500 mb-6">
          You&apos;re currently offline. Please check your internet connection and try again.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg hover:from-pink-600 hover:to-purple-600 transition-all"
        >
          Try Again
        </button>
      </div>
    </div>
  );
} 