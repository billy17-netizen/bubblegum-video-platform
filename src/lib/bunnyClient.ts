/**
 * Client-safe Bunny.net utilities
 * These functions work in both client and server environments
 * for Bunny.net CDN and Stream services
 */

export interface BunnyUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  duration?: number;
  width?: number;
  height?: number;
  bytes: number;
  created_at: string;
}

export interface BunnyVideoInfo {
  guid: string;
  title: string;
  length: number;
  status: number;
  framerate: number;
  width: number;
  height: number;
  availableResolutions: string;
  thumbnailCount: number;
  encodeProgress: number;
  storageSize: number;
  captions: any[];
  hasMP4Fallback: boolean;
  collectionId: string;
  thumbnailFileName: string;
  averageWatchTime: number;
  totalWatchTime: number;
  category: string;
  chapters: any[];
  moments: any[];
  metaTags: any[];
  transcodingMessages: any[];
}

/**
 * Generate optimized video URL using Bunny.net Stream
 */
export function getBunnyStreamUrl(
  videoId: string,
  options: {
    width?: number;
    height?: number;
    token?: string;
    expires?: number;
  } = {}
): string {
  const {
    width,
    height,
    token,
    expires
  } = options;

  const pullZone = process.env.NEXT_PUBLIC_BUNNY_PULL_ZONE || process.env.BUNNY_PULL_ZONE;
  
  if (!pullZone) {
    console.warn('[Bunny] Pull zone not configured');
    return '';
  }

  let url = `https://${pullZone}/${videoId}/playlist.m3u8`;
  
  // Add token and expires for secure content
  if (token && expires) {
    const params = new URLSearchParams({
      token,
      expires: expires.toString()
    });
    url += `?${params.toString()}`;
  }

  return url;
}

/**
 * Generate optimized video poster/thumbnail URL using Bunny.net
 */
export function getBunnyThumbnailUrl(
  videoId: string,
  options: {
    width?: number;
    height?: number;
    time?: number; // Time in seconds for thumbnail
  } = {}
): string {
  const {
    width = 640,
    height = 360,
    time = 0
  } = options;

  const pullZone = process.env.NEXT_PUBLIC_BUNNY_PULL_ZONE || process.env.BUNNY_PULL_ZONE;
  
  if (!pullZone) {
    console.warn('[Bunny] Pull zone not configured');
    return '';
  }

  return `https://${pullZone}/${videoId}/${time}.jpg`;
}

/**
 * Generate direct video file URL for MP4 playback
 */
export function getBunnyVideoUrl(
  videoId: string,
  resolution: string = '1080p',
  options: {
    token?: string;
    expires?: number;
  } = {}
): string {
  const {
    token,
    expires
  } = options;

  const pullZone = process.env.NEXT_PUBLIC_BUNNY_PULL_ZONE || process.env.BUNNY_PULL_ZONE;
  
  if (!pullZone) {
    console.warn('[Bunny] Pull zone not configured');
    return '';
  }

  let url = `https://${pullZone}/${videoId}/play_${resolution}.mp4`;
  
  // Add token and expires for secure content
  if (token && expires) {
    const params = new URLSearchParams({
      token,
      expires: expires.toString()
    });
    url += `?${params.toString()}`;
  }

  return url;
}

/**
 * Check if URL is a Bunny.net URL
 */
export function isBunnyUrl(url: string): boolean {
  return url.includes('.b-cdn.net') || url.includes('bunnycdn.com');
}

/**
 * Extract video ID from Bunny.net URL
 */
export function extractBunnyVideoId(bunnyUrl: string): string | null {
  try {
    // Match pattern: https://pull-zone.b-cdn.net/video-id/...
    const match = bunnyUrl.match(/\/([a-f0-9-]{36})\//i);
    return match ? match[1] : null;
  } catch (error) {
    console.error('[Bunny] Failed to extract video ID:', error);
    return null;
  }
}

/**
 * Generate secure token for protected content
 */
export function generateSecureToken(
  videoId: string,
  securityKey: string,
  expirationTime: number
): string {
  // This is a simplified version - you might need crypto for production
  const data = `${videoId}${expirationTime}`;
  // In production, use HMAC-SHA256 with securityKey
  return btoa(data);
}

/**
 * Get video streaming URL with adaptive quality (HLS)
 */
export function getBunnyHLSUrl(videoId: string): string {
  const pullZone = process.env.NEXT_PUBLIC_BUNNY_PULL_ZONE || process.env.BUNNY_PULL_ZONE;
  
  if (!pullZone) {
    console.warn('[Bunny] Pull zone not configured');
    return '';
  }

  return `https://${pullZone}/${videoId}/playlist.m3u8`;
}

/**
 * Get all available resolutions for a video
 */
export function getBunnyVideoResolutions(videoId: string): string[] {
  // Common Bunny.net resolutions
  return ['240p', '360p', '480p', '720p', '1080p'];
}

/**
 * Generate CDN URL for static files (images, thumbnails)
 */
export function getBunnyCDNUrl(
  fileName: string,
  folder: string = '',
  storageZone?: string
): string {
  const zone = storageZone || process.env.NEXT_PUBLIC_BUNNY_STORAGE_ZONE;
  // Use storage pull zone for static files, fallback to main pull zone
  const storagePullZone = process.env.NEXT_PUBLIC_BUNNY_STORAGE_PULL_ZONE || 'bubblegum-cdn.b-cdn.net';
  
  if (!storagePullZone) {
    console.warn('[Bunny] Storage pull zone not configured');
    return '';
  }

  const path = folder ? `${folder}/${fileName}` : fileName;
  return `https://${storagePullZone}/${path}`;
} 