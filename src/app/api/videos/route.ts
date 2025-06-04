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
  
  // Handle Date objects properly
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  if (typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return obj.map(convertBigIntToNumber);
    }
    
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToNumber(value);
    }
    return converted;
  }
  
  return obj;
}

export async function GET(req: NextRequest) {
  try {
    // Extract pagination parameters from URL
    const url = new URL(req.url);
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');
    
    // If no limit is provided, fetch ALL videos
    const shouldPaginate = limitParam !== null || offsetParam !== null;
    
    let validLimit: number;
    let validOffset: number;
    
    if (shouldPaginate) {
      // Use pagination when explicitly requested
      const limit = parseInt(limitParam || '10');
      const offset = parseInt(offsetParam || '0');
      validLimit = Math.min(Math.max(limit, 1), 50); // Min 1, Max 50
      validOffset = Math.max(offset, 0); // Min 0
    } else {
      // Load ALL videos when no pagination parameters
      validLimit = undefined as any; // Remove limit
      validOffset = 0;
    }

    // Get total count
    const totalCount = await prisma.video.count();
    
    // Fetch videos with or without pagination
    const findManyOptions: any = {
      select: {
        id: true,
        title: true,
        description: true,
        thumbnail: true,
        likes: true,
        views: true,
        createdAt: true,
        // Essential fields for video URLs
        filePath: true,
        cloudinaryPublicId: true,
        cloudinaryUrl: true,
        thumbnailPublicId: true,
        thumbnailUrl: true,
        googleDriveFileId: true,
        googleDriveVideoUrl: true,
        googleDriveThumbnailId: true,
        googleDriveThumbnailUrl: true,
        // Bunny.net fields
        bunnyVideoId: true,
        bunnyStreamUrl: true,
        bunnyThumbnailUrl: true,
        storageType: true,
        // Minimal admin info
        admin: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    };
    
    // Only add pagination if requested
    if (shouldPaginate) {
      findManyOptions.take = validLimit;
      findManyOptions.skip = validOffset;
    }
    
    const videos = await prisma.video.findMany(findManyOptions);
    
    // Enrich videos with best URLs using video service
    const enrichedVideos = videos.map(video => ({
      ...video,
      bestVideoUrl: getSafeVideoUrl(video as any),
      bestThumbnailUrl: getSafeThumbnailUrl(video as any),
      storageType: getVideoStorageType(video as any)
    }));
    
    // Convert any BigInt values to numbers for JSON serialization
    const serializedVideos = convertBigIntToNumber(enrichedVideos);
    
    // Create response based on pagination mode
    if (shouldPaginate) {
      // Return paginated response
      const hasMore = validOffset + validLimit < totalCount;
      const nextOffset = hasMore ? validOffset + validLimit : null;
      const remainingVideos = totalCount - (validOffset + videos.length);
      
      return NextResponse.json({ 
        videos: serializedVideos,
        pagination: {
          limit: validLimit,
          offset: validOffset,
          total: totalCount,
          hasMore,
          nextOffset,
          remaining: remainingVideos,
          progress: {
            current: validOffset + videos.length,
            total: totalCount,
            percentage: Math.round(((validOffset + videos.length) / totalCount) * 100)
          }
        }
      });
    } else {
      // Return all videos without pagination
      return NextResponse.json({ 
        videos: serializedVideos,
        total: totalCount
      });
    }
  } catch (error) {
    console.error("Error fetching videos:", error);
    return NextResponse.json(
      { error: "Failed to fetch videos" },
      { status: 500 }
    );
  }
} 