import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { stat } from "fs/promises";
// Import the configured cloudinary instance
import cloudinary from '@/lib/cloudinary';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const url = new URL(request.url);
    
    console.log(`[Stream API] Request for video ${videoId} with params:`, {
      width: url.searchParams.get('w'),
      height: url.searchParams.get('h'),
      quality: url.searchParams.get('q')
    });
    
    // Get quality parameters
    const width = parseInt(url.searchParams.get('w') || '720');
    const height = parseInt(url.searchParams.get('h') || '1280');
    const quality = url.searchParams.get('q') || 'auto';

    // Get video from database
    const video = await prisma.video.findUnique({
      where: { id: videoId }
    });

    if (!video) {
      console.log(`[Stream API] Video not found: ${videoId}`);
      return new NextResponse('Video not found', { status: 404 });
    }

    console.log(`[Stream API] Video found:`, {
      id: video.id,
      title: video.title,
      cloudinaryUrl: video.cloudinaryUrl,
      cloudinaryPublicId: video.cloudinaryPublicId,
      googleDriveVideoUrl: video.googleDriveVideoUrl,
      filePath: video.filePath
    });

    // Determine video file path
    let videoPath: string;
    
    if (video.cloudinaryUrl) {
      try {
        // Check if this is a private Cloudinary URL
        const isPrivateUrl = video.cloudinaryUrl.includes('/private/');
        
        console.log(`[Stream API] Cloudinary URL detected. Private: ${isPrivateUrl}`);
        console.log(`[Stream API] Cloudinary config check:`, {
          cloudName: process.env.CLOUDINARY_CLOUD_NAME ? 'Set' : 'Missing',
          apiKey: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Missing',
          apiSecret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Missing'
        });
        
        if (isPrivateUrl) {
          console.log(`[Stream API] Handling private Cloudinary video`);
          
          // Try to get the correct public ID
          let publicId: string | null = video.cloudinaryPublicId;
          
          // If the stored public ID doesn't work, try to extract it from the URL
          if (!publicId || publicId.trim() === '') {
            publicId = extractPublicIdFromUrl(video.cloudinaryUrl);
            console.log(`[Stream API] Using extracted public ID: ${publicId}`);
          }
          
          if (publicId) {
            try {
              // Instead of redirecting to signed URL, try to fetch and proxy the video
              console.log(`[Stream API] Attempting to fetch private video via Cloudinary SDK`);
              
              // Generate a signed URL for fetching (not for redirect)
              const signedUrl = cloudinary.url(publicId, {
                resource_type: 'video',
                type: 'authenticated',
                sign_url: true,
                secure: true,
                transformation: [
                  { width, height, crop: 'fill' },
                  { quality: quality === 'auto' ? 'auto:good' : quality },
                  { format: 'auto' }
                ]
              });
              
              console.log(`[Stream API] Generated signed URL for fetching: ${signedUrl}`);
              
              // Try to fetch the video from the signed URL
              const response = await fetch(signedUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; NextJS-VideoProxy/1.0)',
                }
              });
              
              if (response.ok) {
                console.log(`[Stream API] Successfully fetched from signed URL, proxying to client`);
                
                // Get content headers
                const contentType = response.headers.get('content-type') || 'video/mp4';
                const contentLength = response.headers.get('content-length');
                
                // Stream the response
                const headers = new Headers({
                  'Content-Type': contentType,
                  'Accept-Ranges': 'bytes',
                  'Cache-Control': 'public, max-age=3600'
                });
                
                if (contentLength) {
                  headers.set('Content-Length', contentLength);
                }
                
                return new NextResponse(response.body, {
                  status: 200,
                  headers
                });
              } else {
                console.error(`[Stream API] Signed URL fetch failed: ${response.status} ${response.statusText}`);
                throw new Error(`Signed URL fetch failed: ${response.status}`);
              }
            } catch (signedUrlError) {
              console.error(`[Stream API] Failed to fetch via signed URL:`, signedUrlError);
            }
          } else {
            console.error(`[Stream API] No valid public ID found for video ${videoId}`);
          }
          
          // Fallback: Try to proxy the private video through our server
          console.log(`[Stream API] Attempting to proxy private Cloudinary video`);
          
          try {
            // Use the original Cloudinary URL with basic auth attempt
            const proxyUrl = video.cloudinaryUrl;
            console.log(`[Stream API] Proxying URL: ${proxyUrl}`);
            
            // Fetch the video from Cloudinary
            const response = await fetch(proxyUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; NextJS-VideoProxy/1.0)',
              }
            });
            
            if (!response.ok) {
              throw new Error(`Cloudinary fetch failed: ${response.status} ${response.statusText}`);
            }
            
            console.log(`[Stream API] Successfully fetched from Cloudinary, proxying to client`);
            
            // Get content headers
            const contentType = response.headers.get('content-type') || 'video/mp4';
            const contentLength = response.headers.get('content-length');
            
            // Stream the response
            const headers = new Headers({
              'Content-Type': contentType,
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=3600'
            });
            
            if (contentLength) {
              headers.set('Content-Length', contentLength);
            }
            
            return new NextResponse(response.body, {
              status: 200,
              headers
            });
            
          } catch (proxyError) {
            console.error(`[Stream API] Proxy attempt failed:`, proxyError);
            // Continue to local file fallback
          }
        } else {
          // For public Cloudinary videos, use normal transformation
          console.log(`[Stream API] Using public Cloudinary transformation`);
          const transformedUrl = video.cloudinaryUrl.replace(
            '/upload/',
            `/upload/w_${width},h_${height},c_fill,q_${quality === 'auto' ? 'auto:good' : quality},f_auto/`
          );
          
          console.log(`[Stream API] Transformed URL: ${transformedUrl}`);
          
          return NextResponse.redirect(transformedUrl, {
            status: 302,
            headers: {
              'Cache-Control': 'public, max-age=31536000, immutable', // 1 year cache for public Cloudinary
              'Expires': new Date(Date.now() + 31536000 * 1000).toUTCString(),
              'ETag': `"${videoId}-${width}x${height}-${quality}"`,
              'Vary': 'Accept-Encoding',
            }
          });
        }
      } catch (cloudinaryError) {
        console.error(`[Stream API] Cloudinary error for video ${videoId}:`, cloudinaryError);
        console.error(`[Stream API] Cloudinary error details:`, {
          message: cloudinaryError instanceof Error ? cloudinaryError.message : String(cloudinaryError),
          stack: cloudinaryError instanceof Error ? cloudinaryError.stack : 'No stack',
          type: typeof cloudinaryError
        });
        // Fall through to check for local file as fallback
      }
    } else if (video.googleDriveVideoUrl) {
      console.log(`[Stream API] Using Google Drive URL: ${video.googleDriveVideoUrl}`);
      // For Google Drive videos, redirect with cache headers
      return NextResponse.redirect(video.googleDriveVideoUrl, {
        status: 302,
        headers: {
          'Cache-Control': 'public, max-age=3600', // 1 hour cache for Google Drive
          'Expires': new Date(Date.now() + 3600 * 1000).toUTCString(),
          'ETag': `"${videoId}-gdrive"`,
        }
      });
    }

    // For local videos or fallback, serve with optimized caching
    if (video.filePath) {
      console.log(`[Stream API] Using local file path: ${video.filePath}`);
      videoPath = path.join(process.cwd(), 'public', video.filePath);
    } else {
      console.log(`[Stream API] No video source available for ${videoId}`);
      return new NextResponse('Video source not available', { status: 404 });
    }

    console.log(`[Stream API] Checking local file: ${videoPath}`);

    // Check if local video file exists
    try {
      await stat(videoPath);
      console.log(`[Stream API] Local file exists: ${videoPath}`);
    } catch (error) {
      console.log(`[Stream API] Local file not found: ${videoPath}`, error);
      return new NextResponse('Video file not found', { status: 404 });
    }

    // Get file stats for proper HTTP headers
    const stats = await stat(videoPath);
    const fileSize = stats.size;
    const lastModified = stats.mtime.toUTCString();
    
    console.log(`[Stream API] Serving local file. Size: ${fileSize} bytes`);
    
    // Generate ETag based on file stats and quality parameters
    const etag = `"${videoId}-${stats.mtime.getTime()}-${fileSize}-${width}x${height}"`;
    
    // Check for conditional requests
    const ifNoneMatch = request.headers.get('if-none-match');
    const ifModifiedSince = request.headers.get('if-modified-since');
    
    if (ifNoneMatch === etag || (ifModifiedSince && new Date(ifModifiedSince) >= stats.mtime)) {
      return new NextResponse(null, { 
        status: 304,
        headers: {
          'Cache-Control': 'public, max-age=86400, must-revalidate', // 24 hours
          'ETag': etag,
          'Last-Modified': lastModified,
        }
      });
    }

    // Handle range requests for video streaming
    const range = request.headers.get('range');
    
    if (range) {
      // Parse range header
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      // Create file stream for the requested range
      const stream = fs.createReadStream(videoPath, { start, end });
      
      // Determine proper Content-Type based on file extension
      const ext = path.extname(videoPath).toLowerCase();
      let contentType = 'video/mp4'; // default
      
      switch (ext) {
        case '.mp4':
          contentType = 'video/mp4';
          break;
        case '.webm':
          contentType = 'video/webm';
          break;
        case '.ogg':
        case '.ogv':
          contentType = 'video/ogg';
          break;
        case '.mov':
          contentType = 'video/quicktime';
          break;
        case '.avi':
          contentType = 'video/x-msvideo';
          break;
        case '.mkv':
          contentType = 'video/x-matroska';
          break;
        default:
          contentType = 'video/mp4';
      }
      
      return new NextResponse(stream as any, {
        status: 206, // Partial Content
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize.toString(),
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400, must-revalidate', // 24 hours cache
          'Expires': new Date(Date.now() + 86400 * 1000).toUTCString(),
          'ETag': etag,
          'Last-Modified': lastModified,
          'Vary': 'Accept-Encoding, Range',
          // Performance optimization headers
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'SAMEORIGIN',
        }
      });
    } else {
      // Serve entire file with aggressive caching
      const stream = fs.createReadStream(videoPath);
      
      // Determine proper Content-Type based on file extension
      const ext = path.extname(videoPath).toLowerCase();
      let contentType = 'video/mp4'; // default
      
      switch (ext) {
        case '.mp4':
          contentType = 'video/mp4';
          break;
        case '.webm':
          contentType = 'video/webm';
          break;
        case '.ogg':
        case '.ogv':
          contentType = 'video/ogg';
          break;
        case '.mov':
          contentType = 'video/quicktime';
          break;
        case '.avi':
          contentType = 'video/x-msvideo';
          break;
        case '.mkv':
          contentType = 'video/x-matroska';
          break;
        default:
          contentType = 'video/mp4';
      }
      
      return new NextResponse(stream as any, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': fileSize.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=86400, must-revalidate', // 24 hours cache
          'Expires': new Date(Date.now() + 86400 * 1000).toUTCString(),
          'ETag': etag,
          'Last-Modified': lastModified,
          'Vary': 'Accept-Encoding',
          // Performance optimization headers
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'SAMEORIGIN',
          // Preload hints for better performance
          'Link': `<${getOptimizedThumbnailUrl(video, width)}>; rel=preload; as=image`,
        }
      });
    }

  } catch (error) {
    console.error('[Stream API] Error streaming video:', error);
    console.error('[Stream API] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack',
      type: typeof error
    });
    return new NextResponse('Internal server error', { status: 500 });
  }
}

// Helper function to get optimized thumbnail URL
function getOptimizedThumbnailUrl(video: any, width: number): string {
  if (video.thumbnailUrl && video.thumbnailUrl.includes('cloudinary.com')) {
    return video.thumbnailUrl.replace(
      '/upload/',
      `/upload/w_${Math.round(width * 0.8)},h_${Math.round(width * 0.8 * 16/9)},c_fill,q_auto:good,f_auto/`
    );
  }
  return video.thumbnail || '/placeholder-thumbnail.jpg';
}

// Function to extract public ID from Cloudinary URL
function extractPublicIdFromUrl(cloudinaryUrl: string): string | null {
  try {
    // Handle URLs that may have signatures (s--xxx--) and versions (v123456)
    // Pattern: https://res.cloudinary.com/cloud_name/resource_type/upload/[s--signature--/][v123456/]folder/public_id.ext
    
    // First, remove the base URL part
    const urlParts = cloudinaryUrl.split('/upload/');
    if (urlParts.length !== 2) {
      console.error(`[Stream API] Invalid Cloudinary URL format: ${cloudinaryUrl}`);
      return null;
    }
    
    let pathAfterUpload = urlParts[1];
    
    // Remove signature if present (s--xxx--)
    pathAfterUpload = pathAfterUpload.replace(/^s--[^/]+--\//, '');
    
    // Remove version if present (v123456/)
    pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, '');
    
    // Remove file extension
    const publicId = pathAfterUpload.replace(/\.[^.]+$/, '');
    
    console.log(`[Stream API] Extracted public ID: "${publicId}" from URL: ${cloudinaryUrl}`);
    return publicId;
  } catch (error) {
    console.error(`[Stream API] Failed to extract public ID from URL: ${cloudinaryUrl}`, error);
    return null;
  }
} 