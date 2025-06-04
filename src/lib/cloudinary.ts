import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with timeout settings
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  // Add timeout configurations for production
  timeout: 120000, // 2 minutes timeout
  upload_timeout: 120000, // 2 minutes upload timeout
});

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  duration?: number;
  width: number;
  height: number;
  bytes: number;
  created_at: string;
  eager?: Array<{
    secure_url: string;
    url: string;
    format: string;
    width: number;
    height: number;
    bytes: number;
    transformation: string;
  }>;
}

export interface UploadVideoOptions {
  folder?: string;
  public_id?: string;
  quality?: string;
  format?: string;
  transformation?: any[];
}

/**
 * Upload video to Cloudinary with timeout handling and retry logic
 */
export async function uploadVideo(
  fileBuffer: Buffer,
  options: UploadVideoOptions = {}
): Promise<CloudinaryUploadResult> {
  const {
    folder = 'bubblegum/videos',
    quality = 'auto',
    format = 'mp4',
    ...otherOptions
  } = options;

  // Validate Cloudinary configuration
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    const missing = [];
    if (!process.env.CLOUDINARY_CLOUD_NAME) missing.push('CLOUDINARY_CLOUD_NAME');
    if (!process.env.CLOUDINARY_API_KEY) missing.push('CLOUDINARY_API_KEY');
    if (!process.env.CLOUDINARY_API_SECRET) missing.push('CLOUDINARY_API_SECRET');
    
    throw new Error(`Missing Cloudinary configuration: ${missing.join(', ')}`);
  }

  // Check file size limits
  const fileSizeMB = fileBuffer.length / (1024 * 1024);
  console.log(`[Cloudinary] Video file size: ${fileSizeMB.toFixed(2)}MB`);
  
  if (fileSizeMB > 100) {
    throw new Error(`Video file too large: ${fileSizeMB.toFixed(2)}MB. Maximum allowed: 100MB`);
  }

  // Retry logic for upload
  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Cloudinary] Upload attempt ${attempt}/${maxRetries} - Video size: ${fileSizeMB.toFixed(2)}MB`);
      
      const result = await uploadVideoWithTimeout(fileBuffer, {
        folder,
        quality,
        format,
        timeout: 120000, // 2 minutes
        ...otherOptions
      });

      console.log(`[Cloudinary] Upload successful on attempt ${attempt}`);
      return result;
      
    } catch (error: any) {
      lastError = error;
      console.error(`[Cloudinary] Upload attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        const retryDelay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`[Cloudinary] Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  // All retries failed
  console.error(`[Cloudinary] All ${maxRetries} upload attempts failed`);
  throw new Error(`Failed to upload video after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Upload video with timeout handling
 */
async function uploadVideoWithTimeout(
  fileBuffer: Buffer,
  options: UploadVideoOptions & { timeout?: number } = {}
): Promise<CloudinaryUploadResult> {
  const { timeout = 120000, ...uploadOptions } = options;

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    let isResolved = false;
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        reject(new Error(`Upload timeout after ${timeout / 1000} seconds`));
      }
    }, timeout);

    try {
      console.log('[Cloudinary] Starting video upload with timeout protection...');
      console.log(`[Cloudinary] Timeout set to: ${timeout / 1000} seconds`);
      console.log(`[Cloudinary] Buffer size: ${fileBuffer.length} bytes`);
      
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          folder: uploadOptions.folder,
          quality: uploadOptions.quality,
          format: uploadOptions.format,
          transformation: [
            { quality: 'auto' },
            { format: 'mp4' },
            { video_codec: 'h264' }
          ],
          // Add production optimizations
          eager: [
            { quality: 'auto:low', format: 'mp4' }
          ],
          ...uploadOptions
        },
        (error, result) => {
          clearTimeout(timeoutId);
          
          if (isResolved) return; // Already handled by timeout
          isResolved = true;

          if (error) {
            console.error('[Cloudinary] Upload error:', error);
            reject(error);
          } else if (result) {
            console.log('[Cloudinary] Upload successful:', result.public_id);
            resolve(result as CloudinaryUploadResult);
          } else {
            reject(new Error('Upload failed: No result returned'));
          }
        }
      );

      // Write buffer to stream
      uploadStream.end(fileBuffer);
      
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
 * Upload thumbnail image to Cloudinary
 */
export async function uploadImage(
  fileBuffer: Buffer,
  options: { folder?: string; public_id?: string; preserveAspectRatio?: boolean } = {}
): Promise<CloudinaryUploadResult> {
  const { folder = 'bubblegum/thumbnails', preserveAspectRatio = true, ...otherOptions } = options;

  try {
    console.log('[Cloudinary] Starting image upload...');
    
    // Build transformation based on aspect ratio preference
    const transformation: any[] = [
      { quality: 'auto:good' },
      { format: 'webp' }
    ];
    
    // Only add sizing transformation if preserveAspectRatio is false
    if (!preserveAspectRatio) {
      transformation.push({ width: 640, height: 360, crop: 'fill' });
      console.log('[Cloudinary] Using legacy crop transformation (640x360)');
    } else {
      console.log('[Cloudinary] Preserving original thumbnail aspect ratio');
    }
    
    const result = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder,
          quality: 'auto:good',
          format: 'webp',
          transformation,
          ...otherOptions
        },
        (error, result) => {
          if (error) {
            console.error('[Cloudinary] Image upload error:', error);
            reject(error);
          } else if (result) {
            console.log('[Cloudinary] Image upload successful:', result.public_id);
            console.log('[Cloudinary] Final dimensions:', `${result.width}x${result.height}`);
            resolve(result as CloudinaryUploadResult);
          } else {
            reject(new Error('Image upload failed: No result returned'));
          }
        }
      ).end(fileBuffer);
    });

    return result;
  } catch (error) {
    console.error('[Cloudinary] Image upload failed:', error);
    
    // Better error serialization
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = JSON.stringify(error, null, 2);
    } else {
      errorMessage = String(error);
    }
    
    console.error('[Cloudinary] Detailed image error:', errorMessage);
    throw new Error(`Failed to upload image to Cloudinary: ${errorMessage}`);
  }
}

/**
 * Upload auto-generated thumbnail to Cloudinary with proportional preservation
 * This function doesn't apply any sizing transformations to preserve the 
 * exact dimensions generated by FFmpeg
 */
export async function uploadImagePreserveAspectRatio(
  fileBuffer: Buffer,
  options: { folder?: string; public_id?: string } = {}
): Promise<CloudinaryUploadResult> {
  const { folder = 'bubblegum/thumbnails', ...otherOptions } = options;

  try {
    console.log('[Cloudinary] Starting proportional image upload...');
    console.log('[Cloudinary] Buffer size:', fileBuffer.length, 'bytes');
    
    const result = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder,
          quality: 'auto:good',
          format: 'jpg', // Keep as JPG to match FFmpeg output
          // NO transformation - preserve original dimensions
          ...otherOptions
        },
        (error, result) => {
          if (error) {
            console.error('[Cloudinary] Proportional image upload error:', error);
            reject(error);
          } else if (result) {
            console.log('[Cloudinary] Proportional image upload successful:', result.public_id);
            console.log('[Cloudinary] Preserved dimensions:', `${result.width}x${result.height}`);
            console.log('[Cloudinary] Aspect ratio:', (result.width / result.height).toFixed(2));
            resolve(result as CloudinaryUploadResult);
          } else {
            reject(new Error('Proportional image upload failed: No result returned'));
          }
        }
      ).end(fileBuffer);
    });

    return result;
  } catch (error) {
    console.error('[Cloudinary] Proportional image upload failed:', error);
    
    // Better error serialization
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = JSON.stringify(error, null, 2);
    } else {
      errorMessage = String(error);
    }
    
    console.error('[Cloudinary] Detailed proportional image error:', errorMessage);
    throw new Error(`Failed to upload proportional image to Cloudinary: ${errorMessage}`);
  }
}

/**
 * Delete resource from Cloudinary
 */
export async function deleteResource(
  publicId: string,
  resourceType: 'image' | 'video' = 'video'
): Promise<void> {
  try {
    console.log(`[Cloudinary] Deleting ${resourceType}:`, publicId);
    
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });

    if (result.result !== 'ok') {
      throw new Error(`Failed to delete ${resourceType}: ${result.result}`);
    }

    console.log(`[Cloudinary] Successfully deleted ${resourceType}:`, publicId);
  } catch (error) {
    console.error(`[Cloudinary] Delete ${resourceType} failed:`, error);
    throw new Error(`Failed to delete ${resourceType} from Cloudinary: ${error}`);
  }
}

export default cloudinary; 