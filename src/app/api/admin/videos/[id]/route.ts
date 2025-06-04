import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVideoUrl, getThumbnailUrl, getVideoStorageType } from "@/lib/videoService.client";

// Helper function to convert BigInt values to numbers for JSON serialization
function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return Number(obj);
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

// GET a single video by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("[GET Admin Video] Starting request");
    
    const session = await getServerSession(authOptions);
    console.log("[GET Admin Video] Session check:", session?.user ? `User: ${session.user.username}, Role: ${session.user.role}` : "No session");

    if (!session?.user || session.user.role !== "ADMIN") {
      console.log("[GET Admin Video] Unauthorized access attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    console.log("[GET Admin Video] Video ID:", id);
    
    console.log("[GET Admin Video] Fetching video from database...");
    const video = await prisma.video.findUnique({
      where: { id: id },
      include: {
        admin: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    console.log("[GET Admin Video] Database query result:", video ? `Found: ${video.title}` : "Not found");

    if (!video) {
      console.log("[GET Admin Video] Video not found for ID:", id);
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    console.log("[GET Admin Video] Enriching video data...");
    // Enrich video with service data
    const enrichedVideo = {
      ...video,
      videoUrl: getVideoUrl(video as any),
      thumbnailUrl: getThumbnailUrl(video as any),
      storageType: getVideoStorageType(video as any),
      createdAt: video.createdAt instanceof Date ? video.createdAt.toISOString() : video.createdAt,
    };

    console.log("[GET Admin Video] Converting BigInt values...");
    // Convert any BigInt values to numbers for JSON serialization
    const serializedVideo = convertBigIntToNumber(enrichedVideo);

    console.log("[GET Admin Video] Video enriched successfully, returning response");
    return NextResponse.json({ video: serializedVideo });
  } catch (error) {
    console.error("[GET Admin Video] Error occurred:");
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    console.error("Error type:", typeof error);
    console.error("Full error object:", error);
    
    // Check for specific error types
    if (error && typeof error === 'object') {
      if ('code' in error) {
        console.error("Error code:", (error as any).code);
      }
      if ('meta' in error) {
        console.error("Prisma meta:", (error as any).meta);
      }
    }
    
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// Update video details
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    
    const { title, description } = body;

    // Validate input
    if (!title || title.trim() === '') {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // Update video
    const updatedVideo = await prisma.video.update({
      where: { id: id },
      data: {
        title,
        description,
      },
      include: {
        admin: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    // Enrich updated video with service data
    const enrichedVideo = {
      ...updatedVideo,
      videoUrl: getVideoUrl(updatedVideo as any),
      thumbnailUrl: getThumbnailUrl(updatedVideo as any),
      storageType: getVideoStorageType(updatedVideo as any),
      createdAt: updatedVideo.createdAt instanceof Date ? updatedVideo.createdAt.toISOString() : updatedVideo.createdAt,
    };

    // Convert any BigInt values to numbers for JSON serialization
    const serializedVideo = convertBigIntToNumber(enrichedVideo);

    return NextResponse.json({ video: serializedVideo });
  } catch (error) {
    console.error("Error updating video:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Delete video
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("[DELETE] Starting video deletion process");
    
    // Test database connection
    try {
      await prisma.$connect();
      console.log("[DELETE] Database connection successful");
    } catch (dbError) {
      console.error("[DELETE] Database connection failed:", dbError);
      return NextResponse.json(
        { error: "Database connection failed", details: String(dbError) },
        { status: 500 }
      );
    }
    
    const session = await getServerSession(authOptions);
    console.log("[DELETE] Session check:", session?.user?.role);

    if (!session?.user || session.user.role !== "ADMIN") {
      console.log("[DELETE] Unauthorized access attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    console.log("[DELETE] Video ID to delete:", id);
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.log("[DELETE] Invalid UUID format:", id);
      return NextResponse.json(
        { error: "Invalid video ID format" },
        { status: 400 }
      );
    }
    
    // Check current video count for debugging
    const totalVideos = await prisma.video.count();
    console.log("[DELETE] Total videos in database:", totalVideos);
    
    // Get video data first to clean up associated files
    const video = await prisma.video.findUnique({
      where: { id: id },
      select: {
        id: true,
        cloudinaryPublicId: true,
        thumbnailPublicId: true,
        thumbnail: true,
        filePath: true,
        title: true
      }
    });

    console.log("[DELETE] Video found:", video ? `${video.title} (${video.id})` : 'Not found');

    if (!video) {
      console.log("[DELETE] Video not found for ID:", id);
      console.log("[DELETE] This might be a cached/stale video reference on the frontend");
      return NextResponse.json(
        { error: "Video not found", message: "This video may have been already deleted or doesn't exist in the database" },
        { status: 404 }
      );
    }

    console.log("[DELETE] Attempting to delete video from database...");
    
    // Delete video from database
    // The VideoLike cascade delete should happen automatically based on schema
    await prisma.video.delete({
      where: { id: id },
    });

    console.log("[DELETE] Video successfully deleted from database");

    // TODO: Add cleanup logic for Cloudinary resources and local files
    // This should be implemented when video deletion is fully featured
    if (video.cloudinaryPublicId) {
      console.log("[DELETE] TODO: Clean up Cloudinary video:", video.cloudinaryPublicId);
    }
    if (video.thumbnailPublicId) {
      console.log("[DELETE] TODO: Clean up Cloudinary thumbnail:", video.thumbnailPublicId);
    }
    if (video.filePath) {
      console.log("[DELETE] TODO: Clean up local file:", video.filePath);
    }

    return NextResponse.json({ success: true, message: "Video deleted successfully" });
  } catch (error) {
    console.error("[DELETE] Detailed error information:");
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    console.error("Error type:", typeof error);
    console.error("Full error object:", error);
    
    // Check for specific Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
      console.error("Prisma error code:", (error as any).code);
      console.error("Prisma error meta:", (error as any).meta);
    }
    
    // Check for PostgreSQL errors
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMessage = (error as any).message;
      if (errorMessage.includes('connect')) {
        console.error("Database connection error detected");
      }
      if (errorMessage.includes('constraint')) {
        console.error("Database constraint violation detected");
      }
    }
    
    return NextResponse.json(
      { 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  } finally {
    // Ensure database connection is cleaned up
    await prisma.$disconnect();
  }
} 