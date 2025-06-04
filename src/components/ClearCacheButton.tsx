"use client";

import { useState } from "react";
import { FaTrash, FaSync } from "react-icons/fa";

export default function ClearCacheButton() {
  const [isClearing, setIsClearing] = useState(false);

  const clearAllCache = () => {
    setIsClearing(true);
    
    try {
      // Clear video cache
      localStorage.removeItem('bubblegum_video_cache');
      localStorage.removeItem('bubblegum_cache_version');
      localStorage.removeItem('bubblegum_video_position');
      
      // Clear any other potential cache keys
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('bubblegum_')) {
          localStorage.removeItem(key);
        }
      });
      
      // Clear session storage too
      sessionStorage.clear();
      
      alert('Cache cleared! Please refresh the page.');
      
      // Auto refresh after 1 second
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert('Error clearing cache. Check console for details.');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <button
      onClick={clearAllCache}
      disabled={isClearing}
      className="flex items-center px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
      title="Clear all cache and refresh"
    >
      {isClearing ? <FaSync className="animate-spin mr-2" /> : <FaTrash className="mr-2" />}
      Clear Cache
    </button>
  );
} 