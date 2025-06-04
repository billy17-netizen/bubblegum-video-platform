/**
 * Client-safe Cloudinary utilities
 * These functions work in both client and server environments
 * without requiring the full Cloudinary SDK
 */

/**
 * Generate optimized video URL using Cloudinary URL pattern
 */
export function getOptimizedVideoUrl(
  publicId: string,
  options: {
    quality?: string;
    format?: string;
    width?: number;
    height?: number;
    cloudName?: string;
  } = {}
): string {
  const {
    quality = 'auto',
    format = 'mp4',
    width,
    height,
    cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  } = options;

  if (!cloudName) {
    console.warn('[Cloudinary] Cloud name not found');
    return '';
  }

  const transformations: string[] = [
    `q_${quality}`,
    `f_${format}`,
    'vc_h264'
  ];

  if (width && height) {
    transformations.push(`w_${width}`, `h_${height}`, 'c_fill');
  }

  const transformString = transformations.join(',');
  
  return `https://res.cloudinary.com/${cloudName}/video/upload/${transformString}/${publicId}`;
}

/**
 * Generate optimized thumbnail URL using Cloudinary URL pattern
 */
export function getOptimizedImageUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    quality?: string;
    format?: string;
    cloudName?: string;
  } = {}
): string {
  const {
    width = 640,
    height = 360,
    quality = 'auto:good',
    format = 'webp',
    cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  } = options;

  if (!cloudName) {
    console.warn('[Cloudinary] Cloud name not found');
    return '';
  }

  const transformations = [
    `w_${width}`,
    `h_${height}`,
    'c_fill',
    `q_${quality}`,
    `f_${format}`
  ];

  const transformString = transformations.join(',');
  
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformString}/${publicId}`;
}

/**
 * Get video streaming URL with adaptive quality
 */
export function getStreamingUrl(publicId: string, cloudName?: string): string {
  const actualCloudName = cloudName || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  
  if (!actualCloudName) {
    console.warn('[Cloudinary] Cloud name not found');
    return '';
  }

  return `https://res.cloudinary.com/${actualCloudName}/video/upload/sp_hd,f_mp4/${publicId}`;
}

/**
 * Extract public_id from Cloudinary URL
 */
export function extractPublicId(cloudinaryUrl: string): string | null {
  try {
    // Match pattern: https://res.cloudinary.com/cloud_name/resource_type/upload/v123456/folder/public_id.ext
    const match = cloudinaryUrl.match(/\/v\d+\/(.+?)(?:\.[^.]+)?$/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('[Cloudinary] Failed to extract public_id:', error);
    return null;
  }
}

/**
 * Check if URL is a Cloudinary URL
 */
export function isCloudinaryUrl(url: string): boolean {
  return url.includes('res.cloudinary.com') || url.includes('cloudinary.com');
} 