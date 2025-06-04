import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVideoUrl, getThumbnailUrl, getVideoStorageType, isBunnyVideo } from "@/lib/videoService.client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;

    console.log(`[Debug Video] Starting debug for video ID: ${videoId}`);
    
    // Get video from database
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        admin: {
          select: {
            username: true
          }
        }
      }
    });

    if (!video) {
      return NextResponse.json({
        success: false,
        error: 'Video not found'
      }, { status: 404 });
    }

    // Get URLs using video service
    const videoUrl = getVideoUrl(video as any);
    const thumbnailUrl = getThumbnailUrl(video as any);
    const storageType = getVideoStorageType(video as any);
    const isBunny = isBunnyVideo(video as any);

    // Check Bunny.net video processing status if it's a Bunny video
    let bunnyStatus = null;
    if (isBunny && (video as any).bunnyVideoId) {
      try {
        const bunnyApiKey = process.env.BUNNY_API_KEY;
        const libraryId = process.env.BUNNY_LIBRARY_ID;
        
        if (bunnyApiKey && libraryId) {
          const bunnyApiUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${(video as any).bunnyVideoId}`;
          const response = await fetch(bunnyApiUrl, {
            headers: {
              'AccessKey': bunnyApiKey,
            },
          });
          
          if (response.ok) {
            const bunnyVideoInfo = await response.json();
            bunnyStatus = {
              status: bunnyVideoInfo.status,
              encodeProgress: bunnyVideoInfo.encodeProgress,
              hasMP4Fallback: bunnyVideoInfo.hasMP4Fallback,
              availableResolutions: bunnyVideoInfo.availableResolutions,
              thumbnailCount: bunnyVideoInfo.thumbnailCount,
              statusText: getBunnyStatusText(bunnyVideoInfo.status)
            };
          }
        }
      } catch (error) {
        console.error('[Debug Video] Error fetching Bunny status:', error);
        bunnyStatus = { error: 'Failed to fetch Bunny.net status' };
      }
    }

    const debugInfo = {
      success: true,
      video: {
        id: video.id,
        title: video.title,
        description: video.description,
        
        // Legacy fields
        filePath: video.filePath,
        thumbnail: video.thumbnail,
        
        // Cloudinary fields
        cloudinaryPublicId: video.cloudinaryPublicId,
        cloudinaryUrl: video.cloudinaryUrl,
        thumbnailPublicId: video.thumbnailPublicId,
        thumbnailUrl: video.thumbnailUrl,
        
        // Bunny.net fields
        bunnyVideoId: (video as any).bunnyVideoId,
        bunnyStreamUrl: (video as any).bunnyStreamUrl,
        bunnyThumbnailUrl: (video as any).bunnyThumbnailUrl,
        
        // Google Drive fields
        googleDriveFileId: (video as any).googleDriveFileId,
        googleDriveVideoUrl: (video as any).googleDriveVideoUrl,
        googleDriveThumbnailId: (video as any).googleDriveThumbnailId,
        googleDriveThumbnailUrl: (video as any).googleDriveThumbnailUrl,
        
        // Storage info
        storageType: (video as any).storageType,
        
        // Stats
        views: video.views,
        likes: video.likes,
        createdAt: video.createdAt,
        updatedAt: video.updatedAt
      },
      computed: {
        videoUrl: videoUrl,
        thumbnailUrl: thumbnailUrl,
        detectedStorageType: storageType,
        isBunnyVideo: isBunny,
        hasValidBunnyData: !!((video as any).bunnyVideoId || (video as any).bunnyStreamUrl)
      },
      bunnyStatus: bunnyStatus,
      debug: {
        urlPriority: {
          bunnyVideoId: !!(video as any).bunnyVideoId,
          bunnyStreamUrl: !!(video as any).bunnyStreamUrl,
          cloudinaryUrl: !!video.cloudinaryUrl,
          cloudinaryPublicId: !!video.cloudinaryPublicId,
          filePath: !!video.filePath
        }
      }
    };

    console.log(`[Debug Video] Debug complete for video ${videoId}:`, {
      storageType,
      isBunnyVideo: isBunny,
      hasBunnyData: !!(video as any).bunnyVideoId || !!(video as any).bunnyStreamUrl,
      bunnyStatus: bunnyStatus?.statusText || 'No status'
    });

    return NextResponse.json(debugInfo);
    
  } catch (error) {
    console.error('[Debug Video] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get video data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper function to interpret Bunny.net video status codes
function getBunnyStatusText(status: number): string {
  switch (status) {
    case 0:
      return 'Created - Video created but not uploaded';
    case 1:
      return 'Uploaded - Video uploaded but not processed';
    case 2:
      return 'Processing - Video is being processed';
    case 3:
      return 'Finished - Video processed and ready';
    case 4:
      return 'Failed - Video processing failed';
    case 5:
      return 'Transcoding - Video is being transcoded';
    default:
      return `Unknown status: ${status}`;
  }
} 