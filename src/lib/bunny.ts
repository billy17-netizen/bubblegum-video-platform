import { BunnyUploadResult, BunnyVideoInfo } from './bunnyClient';

// Configure Bunny.net settings
const BUNNY_CONFIG = {
  apiKey: process.env.BUNNY_API_KEY,
  storageApiKey: process.env.BUNNY_STORAGE_API_KEY,
  libraryId: process.env.BUNNY_LIBRARY_ID,
  storageZone: process.env.BUNNY_STORAGE_ZONE,
  region: process.env.BUNNY_REGION || 'sg', // Singapore by default
  pullZone: process.env.BUNNY_PULL_ZONE, // For video streaming: vz-2aa454d7-de6.b-cdn.net
  storagePullZone: process.env.BUNNY_STORAGE_PULL_ZONE || 'bubblegum-cdn.b-cdn.net', // For thumbnails/static files
  timeout: 120000, // 2 minutes timeout
};

export interface UploadVideoOptions {
  title?: string;
  folder?: string;
  collection?: string;
  quality?: string;
  format?: string;
}

export interface UploadImageOptions {
  folder?: string;
  fileName?: string;
  preserveAspectRatio?: boolean;
}

/**
 * Get the correct storage endpoint based on region
 */
function getStorageEndpoint(): string {
  const region = BUNNY_CONFIG.region;
  const baseEndpoint = 'storage.bunnycdn.com';
  
  switch (region) {
    case 'de':
      return `https://${baseEndpoint}`;
    case 'uk':
      return `https://uk.${baseEndpoint}`;
    case 'ny':
      return `https://ny.${baseEndpoint}`;
    case 'la':
      return `https://la.${baseEndpoint}`;
    case 'sg':
      return `https://sg.${baseEndpoint}`;
    case 'se':
      return `https://se.${baseEndpoint}`;
    case 'br':
      return `https://br.${baseEndpoint}`;
    case 'jh':
      return `https://jh.${baseEndpoint}`;
    default:
      return `https://${baseEndpoint}`;
  }
}

/**
 * Upload video to Bunny.net Stream with retry logic
 */
export async function uploadVideo(
  fileBuffer: Buffer,
  options: UploadVideoOptions = {}
): Promise<BunnyUploadResult> {
  const {
    title = `Video_${Date.now()}`,
    collection,
    ...otherOptions
  } = options;

  // Validate Bunny.net configuration
  if (!BUNNY_CONFIG.apiKey || !BUNNY_CONFIG.libraryId) {
    const missing = [];
    if (!BUNNY_CONFIG.apiKey) missing.push('BUNNY_API_KEY');
    if (!BUNNY_CONFIG.libraryId) missing.push('BUNNY_LIBRARY_ID');
    
    throw new Error(`Missing Bunny.net configuration: ${missing.join(', ')}`);
  }

  // Check file size limits (Bunny.net supports larger files than Cloudinary)
  const fileSizeMB = fileBuffer.length / (1024 * 1024);
  console.log(`[Bunny] Video file size: ${fileSizeMB.toFixed(2)}MB`);
  
  if (fileSizeMB > 5000) { // 5GB limit
    throw new Error(`Video file too large: ${fileSizeMB.toFixed(2)}MB. Maximum allowed: 5GB`);
  }

  // Retry logic for upload
  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Bunny] Upload attempt ${attempt}/${maxRetries} - Video size: ${fileSizeMB.toFixed(2)}MB`);
      
      const result = await uploadVideoWithTimeout(fileBuffer, {
        title,
        collection,
        timeout: BUNNY_CONFIG.timeout,
        ...otherOptions
      });

      console.log(`[Bunny] Upload successful on attempt ${attempt}`);
      return result;
      
    } catch (error: any) {
      lastError = error;
      console.error(`[Bunny] Upload attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        const retryDelay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`[Bunny] Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  // All retries failed
  console.error(`[Bunny] All ${maxRetries} upload attempts failed`);
  throw new Error(`Failed to upload video after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Upload video with timeout handling to Bunny.net Stream
 */
async function uploadVideoWithTimeout(
  fileBuffer: Buffer,
  options: UploadVideoOptions & { timeout?: number } = {}
): Promise<BunnyUploadResult> {
  const { timeout = 120000, title, collection, ...uploadOptions } = options;

  return new Promise<BunnyUploadResult>(async (resolve, reject) => {
    let isResolved = false;
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        reject(new Error(`Upload timeout after ${timeout / 1000} seconds`));
      }
    }, timeout);

    try {
      console.log('[Bunny] Starting video upload to Stream...');
      console.log(`[Bunny] Timeout set to: ${timeout / 1000} seconds`);
      console.log(`[Bunny] Buffer size: ${fileBuffer.length} bytes`);

      // Step 1: Create video entry in Bunny Stream
      const createUrl = `https://video.bunnycdn.com/library/${BUNNY_CONFIG.libraryId}/videos`;
      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'AccessKey': BUNNY_CONFIG.apiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          collectionId: collection || '',
        }),
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create video entry: ${createResponse.statusText}`);
      }

      const videoInfo: BunnyVideoInfo = await createResponse.json();
      console.log(`[Bunny] Video entry created with ID: ${videoInfo.guid}`);

      // Step 2: Upload video file
      const uploadUrl = `https://video.bunnycdn.com/library/${BUNNY_CONFIG.libraryId}/videos/${videoInfo.guid}`;
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'AccessKey': BUNNY_CONFIG.apiKey!,
          'Content-Type': 'application/octet-stream',
        },
        body: fileBuffer,
      });

      clearTimeout(timeoutId);
      
      if (isResolved) return; // Already handled by timeout
      isResolved = true;

      if (!uploadResponse.ok) {
        reject(new Error(`Upload failed: ${uploadResponse.statusText}`));
        return;
      }

      console.log('[Bunny] Upload successful:', videoInfo.guid);
      
      // Convert to Cloudinary-compatible format
      const result: BunnyUploadResult = {
        public_id: videoInfo.guid,
        secure_url: `https://${BUNNY_CONFIG.pullZone}/${videoInfo.guid}/playlist.m3u8`,
        url: `https://${BUNNY_CONFIG.pullZone}/${videoInfo.guid}/playlist.m3u8`,
        format: 'mp4',
        duration: videoInfo.length,
        width: videoInfo.width,
        height: videoInfo.height,
        bytes: videoInfo.storageSize,
        created_at: new Date().toISOString(),
      };

      resolve(result);
      
    } catch (error) {
      clearTimeout(timeoutId);
      if (!isResolved) {
        isResolved = true;
        reject(error);
      }
    }
  });
}

/**
 * Upload image/thumbnail to Bunny.net Storage
 */
export async function uploadImage(
  fileBuffer: Buffer,
  options: UploadImageOptions = {}
): Promise<BunnyUploadResult> {
  const { 
    folder = 'thumbnails', 
    fileName = `thumb_${Date.now()}.jpg`,
    preserveAspectRatio = true 
  } = options;

  if (!BUNNY_CONFIG.storageApiKey || !BUNNY_CONFIG.storageZone) {
    const missing = [];
    if (!BUNNY_CONFIG.storageApiKey) missing.push('BUNNY_STORAGE_API_KEY');
    if (!BUNNY_CONFIG.storageZone) missing.push('BUNNY_STORAGE_ZONE');
    
    throw new Error(`Missing Bunny.net storage configuration: ${missing.join(', ')}`);
  }

  try {
    console.log('[Bunny] Starting image upload to Storage...');
    
    const endpoint = getStorageEndpoint();
    const path = folder ? `${folder}/${fileName}` : fileName;
    const uploadUrl = `${endpoint}/${BUNNY_CONFIG.storageZone}/${path}`;

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_CONFIG.storageApiKey!,
        'Content-Type': 'application/octet-stream',
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload image: ${response.statusText}`);
    }

    console.log('[Bunny] Image upload successful');

    // Convert to Cloudinary-compatible format
    const result: BunnyUploadResult = {
      public_id: path,
      secure_url: `https://${BUNNY_CONFIG.storagePullZone}/${path}`,
      url: `https://${BUNNY_CONFIG.storagePullZone}/${path}`,
      format: fileName.split('.').pop() || 'jpg',
      bytes: fileBuffer.length,
      width: 0, // Would need image processing to get dimensions
      height: 0,
      created_at: new Date().toISOString(),
    };

    return result;
    
  } catch (error: any) {
    console.error('[Bunny] Image upload failed:', error);
    throw new Error(`Failed to upload image to Bunny.net: ${error.message}`);
  }
}

/**
 * Upload image with preserved aspect ratio
 */
export async function uploadImagePreserveAspectRatio(
  fileBuffer: Buffer,
  options: UploadImageOptions = {}
): Promise<BunnyUploadResult> {
  return uploadImage(fileBuffer, { ...options, preserveAspectRatio: true });
}

/**
 * Delete resource from Bunny.net
 */
export async function deleteResource(
  resourceId: string,
  resourceType: 'image' | 'video' = 'video'
): Promise<void> {
  try {
    if (resourceType === 'video') {
      // Delete from Bunny Stream
      const deleteUrl = `https://video.bunnycdn.com/library/${BUNNY_CONFIG.libraryId}/videos/${resourceId}`;
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'AccessKey': BUNNY_CONFIG.apiKey!,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete video: ${response.statusText}`);
      }
    } else {
      // Delete from Bunny Storage
      const endpoint = getStorageEndpoint();
      const deleteUrl = `${endpoint}/${BUNNY_CONFIG.storageZone}/${resourceId}`;
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'AccessKey': BUNNY_CONFIG.storageApiKey!,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete image: ${response.statusText}`);
      }
    }

    console.log(`[Bunny] Successfully deleted ${resourceType}: ${resourceId}`);
  } catch (error: any) {
    console.error(`[Bunny] Failed to delete ${resourceType}:`, error);
    throw error;
  }
}

/**
 * Get video information from Bunny Stream
 */
export async function getVideoInfo(videoId: string): Promise<BunnyVideoInfo> {
  if (!BUNNY_CONFIG.apiKey || !BUNNY_CONFIG.libraryId) {
    throw new Error('Missing Bunny.net configuration');
  }

  try {
    const url = `https://video.bunnycdn.com/library/${BUNNY_CONFIG.libraryId}/videos/${videoId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'AccessKey': BUNNY_CONFIG.apiKey!,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get video info: ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('[Bunny] Failed to get video info:', error);
    throw error;
  }
}

/**
 * Delete video from Bunny Stream
 */
export async function deleteBunnyVideo(videoId: string): Promise<void> {
  return deleteResource(videoId, 'video');
}

/**
 * Check if Bunny.net is properly configured
 */
export function isBunnyConfigured(): boolean {
  return !!(BUNNY_CONFIG.apiKey && BUNNY_CONFIG.libraryId && BUNNY_CONFIG.storageApiKey && BUNNY_CONFIG.storageZone);
}

/**
 * Get Bunny.net configuration status
 */
export function getBunnyConfig() {
  return {
    hasApiKey: !!BUNNY_CONFIG.apiKey,
    hasStorageApiKey: !!BUNNY_CONFIG.storageApiKey,
    hasLibraryId: !!BUNNY_CONFIG.libraryId,
    hasStorageZone: !!BUNNY_CONFIG.storageZone,
    hasPullZone: !!BUNNY_CONFIG.pullZone,
    hasStoragePullZone: !!BUNNY_CONFIG.storagePullZone,
    region: BUNNY_CONFIG.region,
    videoPullZone: BUNNY_CONFIG.pullZone,
    storagePullZone: BUNNY_CONFIG.storagePullZone,
  };
} 