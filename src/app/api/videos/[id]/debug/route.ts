import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import cloudinary from '@/lib/cloudinary';

// Function to extract public ID from Cloudinary URL
function extractPublicIdFromUrl(cloudinaryUrl: string): string | null {
  try {
    // Handle URLs that may have signatures (s--xxx--) and versions (v123456)
    // Pattern: https://res.cloudinary.com/cloud_name/resource_type/upload/[s--signature--/][v123456/]folder/public_id.ext
    
    // First, remove the base URL part
    const urlParts = cloudinaryUrl.split('/upload/');
    if (urlParts.length !== 2) {
      return null;
    }
    
    let pathAfterUpload = urlParts[1];
    
    // Remove signature if present (s--xxx--)
    pathAfterUpload = pathAfterUpload.replace(/^s--[^/]+--\//, '');
    
    // Remove version if present (v123456/)
    pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, '');
    
    // Remove file extension
    const publicId = pathAfterUpload.replace(/\.[^.]+$/, '');
    
    return publicId;
  } catch (error) {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;

    // Get video from database
    const video = await prisma.video.findUnique({
      where: { id: videoId }
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const debugInfo = {
      videoId,
      title: video.title,
      cloudinaryUrl: video.cloudinaryUrl,
      cloudinaryPublicId: video.cloudinaryPublicId,
      googleDriveVideoUrl: video.googleDriveVideoUrl,
      filePath: video.filePath,
      isPrivateCloudinary: video.cloudinaryUrl?.includes('/private/') || false,
      extractedPublicId: video.cloudinaryUrl ? extractPublicIdFromUrl(video.cloudinaryUrl) : null,
      videoServiceUrl: null as string | null,
      cloudinaryConfig: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME ? 'Set' : 'Missing',
        apiKey: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Missing',
        apiSecret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Missing'
      },
      signedUrlTest: null as string | null,
      signedUrlError: null as string | null
    };

    // Test what getVideoUrl would return
    try {
      // Simulate the getVideoUrl function logic
      if (video.googleDriveFileId) {
        debugInfo.videoServiceUrl = `/api/videos/${videoId}/google-drive-stream`;
      } else if (video.cloudinaryUrl) {
        if (video.cloudinaryUrl.includes('/private/')) {
          debugInfo.videoServiceUrl = `/api/videos/${videoId}/stream`;
        } else {
          debugInfo.videoServiceUrl = video.cloudinaryUrl;
        }
      } else if (video.cloudinaryPublicId) {
        if (video.cloudinaryPublicId.includes('/private/')) {
          debugInfo.videoServiceUrl = `/api/videos/${videoId}/stream`;
        } else {
          debugInfo.videoServiceUrl = `cloudinary-optimized:${video.cloudinaryPublicId}`;
        }
      } else if (video.filePath) {
        if (video.filePath.includes('/api/videos/')) {
          debugInfo.videoServiceUrl = video.filePath;
        } else if (video.filePath.includes('cloudinary.com') && video.filePath.includes('/private/')) {
          debugInfo.videoServiceUrl = `/api/videos/${videoId}/stream`;
        } else {
          debugInfo.videoServiceUrl = `/api/videos/${videoId}/stream`;
        }
      } else {
        debugInfo.videoServiceUrl = `/api/videos/${videoId}/stream`;
      }
    } catch (error) {
      debugInfo.videoServiceUrl = `Error: ${error instanceof Error ? error.message : String(error)}`;
    }

    // Try to generate a signed URL if it's a private Cloudinary video
    if (debugInfo.isPrivateCloudinary) {
      const publicId = video.cloudinaryPublicId || debugInfo.extractedPublicId;
      
      if (publicId) {
        try {
          const signedUrl = cloudinary.url(publicId, {
            resource_type: 'video',
            type: 'authenticated',
            sign_url: true,
            secure: true,
            transformation: [
              { width: 480, height: 854, crop: 'fill' },
              { quality: 'auto:good' },
              { format: 'auto' }
            ]
          });
          debugInfo.signedUrlTest = signedUrl;
        } catch (error) {
          debugInfo.signedUrlError = error instanceof Error ? error.message : String(error);
        }
      }
    }

    return NextResponse.json(debugInfo);
  } catch (error) {
    console.error('[Debug API] Error:', error);
    return NextResponse.json(
      { 
        error: "Debug failed",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 