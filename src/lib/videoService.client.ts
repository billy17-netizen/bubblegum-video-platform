/**
 * Client-side video service utilities
 * Handles video URL generation and thumbnail processing
 */

export interface VideoData {
  id: string;
  title: string;
  description: string | null;
  filePath: string;
  thumbnail: string | null;
  
  // Video URL (generic)
  videoUrl?: string;
  
  // Cloudinary fields
  cloudinaryPublicId: string | null;
  cloudinaryUrl: string | null;
  thumbnailPublicId: string | null;
  thumbnailUrl: string | null;
  
  // Bunny.net fields
  bunnyVideoId: string | null;
  bunnyStreamUrl: string | null;
  bunnyThumbnailUrl: string | null;
  
  // Storage type
  storageType: string | null;
  
  // Video metadata
  fileSize: bigint | null;
  originalFileName: string | null;
  
  // Video engagement
  views: number;
  likes: number;
}

/**
 * Safe placeholder URL
 */
  const PLACEHOLDER_URL = '/placeholder-thumbnail.svg';

/**
 * Data URL placeholder as fallback - now using simple file path
 */
const DATA_PLACEHOLDER = '/placeholder-thumbnail.svg';

/**
 * Get the best available video URL with fallback priorities
 * Priority: Bunny.net > Cloudinary > Local file path (no streaming API)
 */
export function getVideoUrl(video: VideoData): string | null {
  
  // Bunny.net videos - convert HLS to MP4 if needed
  if (video.bunnyStreamUrl) {
    // If it's HLS, try to convert to MP4
    if (video.bunnyStreamUrl.includes('.m3u8')) {
      const mp4Url = video.bunnyStreamUrl.replace('/playlist.m3u8', '/play_720p.mp4');
      return mp4Url;
    }
    return video.bunnyStreamUrl;
  }
  
  // Cloudinary videos (skip private URLs)
  if (video.cloudinaryUrl && !video.cloudinaryUrl.includes('/private/')) {
    return video.cloudinaryUrl;
  }
  
  // Local videos - only use if it's a valid file path (not streaming API)
  if (video.filePath && !video.filePath.includes('/api/videos/')) {
    return video.filePath;
  }
  
  // Return null if no valid URL available (don't use streaming API)
  return null;
}

/**
 * Get safe video URL with error handling
 */
export function getSafeVideoUrl(video: VideoData): string | null {
  try {
    return getVideoUrl(video);
  } catch (error) {
    console.error('Error getting video URL:', error);
    return null; // Don't fallback to streaming API
  }
}

/**
 * Get the best available thumbnail URL
 * Priority: Manual thumbnail > Bunny auto > Cloudinary auto > Default
 */
export function getThumbnailUrl(video: VideoData): string {
  if (!video) {
    return DATA_PLACEHOLDER;
  }

  // Manual uploaded thumbnail (highest priority)
  if (video.thumbnail && video.thumbnail.trim() !== '') {
    const safeThumbnail = getSafeThumbnailUrl(video);
    if (safeThumbnail !== DATA_PLACEHOLDER) {
      return safeThumbnail;
    }
  }

  // Bunny.net auto thumbnail
  if (video.bunnyThumbnailUrl && video.bunnyThumbnailUrl.trim() !== '') {
    return video.bunnyThumbnailUrl;
  }
  
  // Cloudinary auto thumbnail
  if (video.thumbnailUrl && video.thumbnailUrl.trim() !== '') {
    return video.thumbnailUrl;
  }

  // Default placeholder
  return DATA_PLACEHOLDER;
}

/**
 * Get safe thumbnail URL with proper validation
 */
export function getSafeThumbnailUrl(video: any): string {
  if (!video || !video.thumbnail) {
    return DATA_PLACEHOLDER;
  }

  const thumbnail = video.thumbnail.trim();
  
  // Return placeholder for empty strings
  if (thumbnail === '' || thumbnail === 'null' || thumbnail === 'undefined') {
    return DATA_PLACEHOLDER;
  }

  // Check for invalid URLs
  if (thumbnail.includes('admin/videos') || thumbnail.includes('localhost:3000/admin')) {
    return DATA_PLACEHOLDER;
  }

  // If it starts with / or http, return as is
  if (thumbnail.startsWith('/') || thumbnail.startsWith('http')) {
    return thumbnail;
  }

  // Otherwise assume it's a relative path and add /
  return `/${thumbnail}`;
}

/**
 * Check if video is stored in Cloudinary
 */
export function isCloudinaryVideo(video: VideoData): boolean {
  return !!(video.cloudinaryPublicId || video.cloudinaryUrl);
}

/**
 * Check if video is stored in Bunny.net
 */
export function isBunnyVideo(video: VideoData): boolean {
  return !!(video.bunnyVideoId || video.bunnyStreamUrl);
}

/**
 * Check if video is stored locally
 */
export function isLocalVideo(video: VideoData): boolean {
  return !!video.filePath && !isCloudinaryVideo(video) && !isBunnyVideo(video);
}

/**
 * Check if video is from Google Drive
 */
export function isGoogleDriveVideo(video: VideoData): boolean {
  // Check if the video URL or filePath contains Google Drive indicators
  const googleDrivePattern = /(drive\.google\.com|googleapis\.com)/i;
  
  if (video.cloudinaryUrl && googleDrivePattern.test(video.cloudinaryUrl)) {
    return true;
  }
  
  if (video.bunnyStreamUrl && googleDrivePattern.test(video.bunnyStreamUrl)) {
    return true;
  }
  
  if (video.filePath && googleDrivePattern.test(video.filePath)) {
    return true;
  }
  
  return false;
}

/**
 * Get storage provider name
 */
export function getStorageProviderName(video: VideoData): string {
  if (isBunnyVideo(video)) {
    return 'Bunny.net';
  }
  if (isCloudinaryVideo(video)) {
    return 'Cloudinary';
  }
  if (isLocalVideo(video)) {
    return 'Local Storage';
  }
  return 'Unknown';
}

/**
 * Get video storage type
 */
export function getVideoStorageType(video: VideoData): 'bunny' | 'cloudinary' | 'local' | 'unknown' {
  if (video.storageType) {
    return video.storageType as any;
  }
  
  if (isBunnyVideo(video)) {
    return 'bunny';
  }
  if (isCloudinaryVideo(video)) {
    return 'cloudinary';
  }
  if (isLocalVideo(video)) {
    return 'local';
  }
  return 'unknown';
}

/**
 * Get safe video URL with fallback options
 */
export function getSafeVideoUrlWithFallback(video: VideoData): { primary: string | null; fallback: string | null } {
  try {
    const primary = getVideoUrl(video);
    
    // For Bunny.net videos, provide MP4 variations as fallback
    if (video.bunnyStreamUrl && video.bunnyStreamUrl.includes('.m3u8')) {
      const mp4Url = video.bunnyStreamUrl.replace('/playlist.m3u8', '/play_480p.mp4');
      return {
        primary: primary,
        fallback: mp4Url
      };
    }
    
    // For Cloudinary videos
    if (video.cloudinaryUrl && !video.cloudinaryUrl.includes('/private/')) {
      return {
        primary: video.cloudinaryUrl,
        fallback: video.videoUrl || null
      };
    }
    
    // For local videos, no streaming API fallback
    return {
      primary: primary,
      fallback: video.videoUrl || null
    };
  } catch (error) {
    console.error('Error getting video URL with fallback:', error);
    return {
      primary: null,
      fallback: null
    };
  }
}

/**
 * Get Bunny.net MP4 URL from HLS URL
 */
export function getBunnyMP4Url(bunnyStreamUrl: string): string | null {
  try {
    if (!bunnyStreamUrl || !bunnyStreamUrl.includes('.m3u8')) {
      return null;
    }
    
    // Convert HLS URL to MP4 URL
    // Example: https://vz-xxxx.b-cdn.net/video-id/playlist.m3u8
    // Try multiple MP4 variations that Bunny.net might provide
    const baseUrl = bunnyStreamUrl.replace('/playlist.m3u8', '');
    
    // Try the most common MP4 format first (original)
    const mp4Url = `${baseUrl}/play_720p.mp4`;
    
    console.log('[VideoService] Converting Bunny HLS to MP4:', {
      original: bunnyStreamUrl,
      converted: mp4Url,
      baseUrl: baseUrl
    });
    
    return mp4Url;
  } catch (error) {
    console.error('[VideoService] Error generating Bunny MP4 URL:', error);
    return null;
  }
}

/**
 * Get multiple Bunny MP4 variations for better fallback
 */
export function getBunnyMP4Variations(bunnyStreamUrl: string): string[] {
  const variations: string[] = [];
  
  try {
    if (!bunnyStreamUrl || !bunnyStreamUrl.includes('.m3u8')) {
      return variations;
    }
    
    const baseUrl = bunnyStreamUrl.replace('/playlist.m3u8', '');
    
    // Common Bunny.net MP4 formats
    const possibleFormats = [
      '/play_720p.mp4',
      '/play_480p.mp4',
      '/play_360p.mp4',
      '/play_1080p.mp4',
      '/play.mp4',
      '.mp4'
    ];
    
    possibleFormats.forEach(format => {
      variations.push(`${baseUrl}${format}`);
    });
    
    console.log('[VideoService] Bunny MP4 variations:', variations);
    return variations;
  } catch (error) {
    console.error('[VideoService] Error generating Bunny MP4 variations:', error);
    return variations;
  }
}

/**
 * Get all available video URLs for a video (for fallback purposes)
 */
export function getVideoUrlsWithFallbacks(video: VideoData): string[] {
  const urls: string[] = [];
  
  // Primary URL (converted to MP4 if needed)
  const primaryUrl = getVideoUrl(video);
  if (primaryUrl) {
    urls.push(primaryUrl);
  }
  
  // Multiple Bunny.net MP4 alternatives
  if (video.bunnyStreamUrl && video.bunnyStreamUrl.includes('.m3u8')) {
    const mp4Variations = getBunnyMP4Variations(video.bunnyStreamUrl);
    mp4Variations.forEach(mp4Url => {
      if (!urls.includes(mp4Url)) {
        urls.push(mp4Url);
      }
    });
  }
  
  // Cloudinary URL (only if not private)
  if (video.cloudinaryUrl && !video.cloudinaryUrl.includes('/private/') && !urls.includes(video.cloudinaryUrl)) {
    urls.push(video.cloudinaryUrl);
  }
  
  // Original video URL (only if it's not a streaming API URL)
  if (video.videoUrl && !video.videoUrl.includes('/api/videos/') && !urls.includes(video.videoUrl)) {
    urls.push(video.videoUrl);
  }
  
  // Filter out any remaining HLS URLs and streaming API URLs
  const validUrls = urls.filter(url => 
    url && 
    !url.includes('.m3u8') && 
    !url.includes('/api/videos/') &&
    !url.includes('/private/')
  );
  
  return validUrls;
} 