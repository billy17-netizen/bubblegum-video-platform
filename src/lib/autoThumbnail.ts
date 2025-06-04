/**
 * Auto Thumbnail Generator
 * Lightweight thumbnail generation without FFmpeg dependencies
 */

/**
 * Generate thumbnail from video file using HTML5 Canvas (Client-side only)
 */
export async function generateThumbnailFromVideo(
  videoFile: File,
  timeOffset: number = 10 // seconds from start
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      resolve(null);
      return;
    }

    video.crossOrigin = 'anonymous';
    video.muted = true;
    
    video.onloadedmetadata = () => {
      // Set canvas size to video dimensions (max 1280x720)
      const maxWidth = 1280;
      const maxHeight = 720;
      let { videoWidth, videoHeight } = video;
      
      if (videoWidth > maxWidth) {
        videoHeight = (videoHeight * maxWidth) / videoWidth;
        videoWidth = maxWidth;
      }
      
      if (videoHeight > maxHeight) {
        videoWidth = (videoWidth * maxHeight) / videoHeight;
        videoHeight = maxHeight;
      }
      
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      
      // Seek to specific time
      const seekTime = Math.min(timeOffset, video.duration * 0.1); // 10% into video or timeOffset, whichever is smaller
      video.currentTime = seekTime;
    };
    
    video.onseeked = () => {
      try {
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to blob
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', 0.8);
      } catch (error) {
        console.error('Error generating thumbnail:', error);
        resolve(null);
      }
    };
    
    video.onerror = () => {
      resolve(null);
    };
    
    // Load video
    video.src = URL.createObjectURL(videoFile);
    video.load();
  });
}

/**
 * Convert blob to File
 */
export function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: blob.type });
}

/**
 * Auto generate thumbnail for Cloudinary (uses Cloudinary's auto thumbnail feature)
 */
export function getCloudinaryAutoThumbnailUrl(publicId: string): string {
  return `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload/so_10,w_1280,h_720,c_fill,f_jpg/${publicId}.jpg`;
}

/**
 * Auto generate thumbnail for Bunny (uses video frame extraction)
 */
export function getBunnyAutoThumbnailUrl(videoId: string, libraryId: string): string {
  return `https://vz-${libraryId}.b-cdn.net/${videoId}/thumbnail.jpg`;
}

/**
 * Generate thumbnail filename
 */
export function generateThumbnailFilename(originalVideoName: string): string {
  const nameWithoutExt = originalVideoName.replace(/\.[^/.]+$/, "");
  const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
  return `${safeName}_thumbnail_${Date.now()}.jpg`;
} 