import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Get all videos with basic info
    const videos = await prisma.video.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        createdAt: true,
        cloudinaryPublicId: true,
        cloudinaryUrl: true,
        filePath: true,
        admin: {
          select: {
            username: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20 // Limit to last 20 videos
    });

    return NextResponse.json({
      success: true,
      total: videos.length,
      videos: videos.map(video => {
        // Cast to any to access extended fields that may exist
        const extendedVideo = video as any;
        
        return {
          id: video.id,
          title: video.title,
          description: video.description?.substring(0, 100) + (video.description && video.description.length > 100 ? '...' : ''),
          createdAt: video.createdAt,
          admin: video.admin?.username,
          storage: {
            type: extendedVideo.storageType || 'unknown',
            hasBunnyId: !!extendedVideo.bunnyVideoId,
            hasBunnyUrl: !!extendedVideo.bunnyStreamUrl,
            hasCloudinaryId: !!video.cloudinaryPublicId,
            hasCloudinaryUrl: !!video.cloudinaryUrl,
            hasGoogleDriveId: !!extendedVideo.googleDriveFileId,
            hasFilePath: !!video.filePath
          },
          debugUrl: `/api/debug/video/${video.id}`
        };
      })
    });

  } catch (error) {
    console.error('[Debug Videos] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get videos',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 