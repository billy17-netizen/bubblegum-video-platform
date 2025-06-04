import { thumbnailCacheManager } from './thumbnailCache';

interface Video {
  thumbnailUrl?: string;
  thumbnail?: string | null;
  storageType?: string;
  [key: string]: any;
}

export async function getSafeThumbnailUrl(video: Video): Promise<string> {
  if (!video) return '';

  // Priority order: thumbnailUrl -> thumbnail -> generate default
  const thumbnailUrl = video.thumbnailUrl || video.thumbnail || '';

  if (thumbnailUrl) {
    // Handle different storage types
    if (video.storageType === 'cloudinary') {
      // Cloudinary URLs are always accessible
      return thumbnailUrl;
    } else {
      // Local storage - only add cache busting on server side
      if (typeof window === 'undefined') {
        // Server-side: verify file exists and add cache busting
        try {
          const { existsSync, statSync } = await import('fs');
          if (thumbnailUrl.startsWith('/thumbnails/')) {
            const fullPath = `./public${thumbnailUrl}`;
            if (existsSync(fullPath)) {
              const stats = statSync(fullPath);
              const timestamp = stats.mtime.getTime();
              return `${thumbnailUrl}?t=${timestamp}`;
            }
          }
        } catch (error) {
          console.warn('File system check failed:', error);
        }
      }
      
      // Client-side or fallback: return URL as-is
      return thumbnailUrl;
    }
  }

  // Generate default thumbnail URL
  return '/images/default-thumbnail.jpg';
}

// Force thumbnail refresh for specific video
export async function refreshVideoThumbnail(videoId: string): Promise<void> {
  thumbnailCacheManager.refreshThumbnail(videoId);
  
  // You can add database update logic here if needed
  console.log(`🔄 Thumbnail refreshed for video: ${videoId}`);
}

// Clear all thumbnail caches
export function clearAllThumbnailCaches(): void {
  thumbnailCacheManager.clearCache();
}