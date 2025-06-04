import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSafeVideoUrl, getSafeThumbnailUrl, getVideoStorageType } from "@/lib/videoService.client";

// Helper function to convert BigInt values to numbers for JSON serialization
function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  
  // Handle Date objects specially
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  if (typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return obj.map(convertBigIntToNumber);
    }
    
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Special handling for date fields
      if ((key === 'createdAt' || key === 'updatedAt') && value instanceof Date) {
        converted[key] = value.toISOString();
      } else {
        converted[key] = convertBigIntToNumber(value);
      }
    }
    return converted;
  }
  
  return obj;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let videoId: string = 'unknown';
  
  try {
    const { id } = await params;
    videoId = id; // Store for error handling

    console.log(`Fetching video with id: ${id}`);
    
    const video = await prisma.video.findUnique({
      where: { id },
      include: {
        admin: {
          select: {
            id: true,
            username: true,
          },
        },
        userLikes: true,
        _count: {
          select: {
            userLikes: true,
          },
        },
      },
    });

    if (!video) {
      console.log(`Video with id ${id} not found`);
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    console.log(`[VideoAPI] Video found: ${video.title}`);
    console.log(`[VideoAPI] Video raw data check:`, {
      id: video.id,
      hasCloudinaryId: !!video.cloudinaryPublicId,
      hasCloudinaryUrl: !!video.cloudinaryUrl,
      hasGoogleDriveId: !!video.googleDriveFileId,
      hasGoogleDriveUrl: !!video.googleDriveVideoUrl,
      hasFilePath: !!video.filePath,
      hasThumbnail: !!video.thumbnail,
      hasAdmin: !!video.admin
    });

    // Try to enrich video data with proper error handling
    let bestVideoUrl: string | null = null;
    let bestThumbnailUrl: string | null = null;
    let storageType: string = 'unknown';

    try {
      console.log(`[VideoAPI] Attempting to get safe video URL...`);
      bestVideoUrl = getSafeVideoUrl(video as any);
      console.log(`[VideoAPI] Safe video URL result: ${bestVideoUrl}`);
    } catch (videoUrlError) {
      console.error(`[VideoAPI] Error getting video URL:`, videoUrlError);
      // Fallback: construct basic URL
      bestVideoUrl = video.cloudinaryUrl || 
                    video.googleDriveVideoUrl || 
                    video.filePath || 
                    `/api/videos/${video.id}/stream`;
      console.log(`[VideoAPI] Using fallback video URL: ${bestVideoUrl}`);
    }

    try {
      console.log(`[VideoAPI] Attempting to get safe thumbnail URL...`);
      bestThumbnailUrl = getSafeThumbnailUrl(video as any);
      console.log(`[VideoAPI] Safe thumbnail URL result: ${bestThumbnailUrl}`);
    } catch (thumbnailUrlError) {
      console.error(`[VideoAPI] Error getting thumbnail URL:`, thumbnailUrlError);
      // Fallback: use existing thumbnail data
      bestThumbnailUrl = video.thumbnailUrl || video.thumbnail || null;
      console.log(`[VideoAPI] Using fallback thumbnail URL: ${bestThumbnailUrl}`);
    }

    try {
      console.log(`[VideoAPI] Attempting to get storage type...`);
      storageType = getVideoStorageType(video as any);
      console.log(`[VideoAPI] Storage type result: ${storageType}`);
    } catch (storageTypeError) {
      console.error(`[VideoAPI] Error getting storage type:`, storageTypeError);
      // Fallback: determine storage type manually
      if (video.googleDriveFileId) {
        storageType = 'google-drive';
      } else if (video.cloudinaryPublicId) {
        storageType = 'cloudinary';
      } else if (video.filePath) {
        storageType = 'local';
      } else {
        storageType = 'unknown';
      }
      console.log(`[VideoAPI] Using fallback storage type: ${storageType}`);
    }

    const enrichedVideo = {
      ...video,
      bestVideoUrl,
      bestThumbnailUrl,
      storageType
    };

    console.log(`[VideoAPI] ✅ Video data prepared for: ${video.title}, storage: ${storageType}`);
    
    // Convert BigInt values before any JSON operations
    const convertedEnrichedVideo = convertBigIntToNumber(enrichedVideo);
    
    // Log the final response structure before sending
    console.log(`[VideoAPI] Returning response with keys:`, Object.keys({ video: convertedEnrichedVideo }));
    console.log(`[VideoAPI] Video object keys:`, Object.keys(convertedEnrichedVideo));
    console.log(`[VideoAPI] Response size:`, JSON.stringify({ video: convertedEnrichedVideo }).length, 'characters');
    
    const finalResponse = { video: convertedEnrichedVideo };
    return NextResponse.json(finalResponse);
  } catch (error) {
    console.error(`[VideoAPI] ❌ CRITICAL ERROR fetching video ${videoId}:`, error);
    console.error(`[VideoAPI] Error type:`, typeof error);
    console.error(`[VideoAPI] Error name:`, error instanceof Error ? error.name : 'Unknown');
    console.error(`[VideoAPI] Error message:`, error instanceof Error ? error.message : 'Unknown error');
    console.error(`[VideoAPI] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
    
    // Return more detailed error in development
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json(
        { 
          error: "Failed to fetch video",
          details: {
            videoId: videoId,
            errorType: error instanceof Error ? error.name : 'Unknown',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          }
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to fetch video" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete the video
    await prisma.video.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Video deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting video:", error);
    return NextResponse.json(
      { error: "Failed to delete video" },
      { status: 500 }
    );
  }
} 