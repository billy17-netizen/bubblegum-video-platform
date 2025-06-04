import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSafeThumbnailUrl, getVideoStorageType } from "@/lib/videoService.client";

// GET all videos for admin management
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get URL parameters for pagination and sorting
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const sortBy = url.searchParams.get('sortBy') || 'createdAt';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    console.log(`[Admin Videos API] Fetching videos with limit: ${limit}, offset: ${offset}`);

    // Get total count
    const totalCount = await prisma.video.count();

    // Fetch all videos with complete data including Cloudinary fields
    const videos = await prisma.video.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        views: true,
        likes: true,
        createdAt: true,
        // Legacy fields
        thumbnail: true,
        filePath: true,
        // Cloudinary fields
        cloudinaryPublicId: true,
        cloudinaryUrl: true,
        thumbnailPublicId: true,
        thumbnailUrl: true,
        admin: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        [sortBy]: sortOrder as 'asc' | 'desc',
      },
      take: limit,
      skip: offset,
    });

    // Enrich videos with best thumbnail URLs
    const enrichedVideos = videos.map(video => {
      const bestThumbnailUrl = getSafeThumbnailUrl(video as any);
      const storageType = getVideoStorageType(video as any);
      
      return {
        id: video.id,
        title: video.title,
        description: video.description,
        views: video.views,
        likes: video.likes,
        thumbnail: bestThumbnailUrl, // Use the best available thumbnail
        createdAt: video.createdAt,
        storageType,
        timeAgo: getTimeAgo(video.createdAt),
        admin: video.admin,
      };
    });

    console.log(`[Admin Videos API] Returning ${enrichedVideos.length} videos`);

    return NextResponse.json({
      videos: enrichedVideos,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      }
    });
  } catch (error) {
    console.error("Error fetching admin videos:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to calculate time ago
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds} seconds ago`;
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago`;
} 