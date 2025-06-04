import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    console.log("Like API - Session:", { 
      hasSession: !!session, 
      hasUser: !!session?.user, 
      userId: session?.user?.id,
      sessionData: session 
    });

    if (!session?.user) {
      console.log("Like API - No session or user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user ID exists
    const userId = session.user.id;
    if (!userId) {
      console.log("Like API - No user ID in session");
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { id: videoId } = await params;
    
    console.log("Like API - Video ID:", videoId, "User ID:", userId);
    
    // Check if the user exists in database
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });
    
    if (!userExists) {
      console.log("Like API - User not found in database:", userId);
      return NextResponse.json(
        { error: "User not found in database" },
        { status: 404 }
      );
    }
    
    // Check if the video exists
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });
    
    if (!video) {
      console.log("Like API - Video not found:", videoId);
      return NextResponse.json(
        { error: "Video not found", liked: false, likes: 0 },
        { status: 404 }
      );
    }

    // Check if user already liked the video using composite key
    const existingLike = await prisma.videoLike.findUnique({
      where: {
        userId_videoId: {
          userId: userId,
          videoId: videoId
        }
      }
    });
    
    console.log("Like API - Existing like:", { 
      hasExistingLike: !!existingLike, 
      userId: userId, 
      videoId 
    });

    let result;
    
    try {
      if (existingLike) {
        console.log("Like API - Removing like");
        // Unlike the video (remove the like)
        await prisma.videoLike.delete({
          where: {
            userId_videoId: {
              userId: userId,
              videoId: videoId
            }
          }
        });
        
        // Decrement like count
        result = await prisma.video.update({
          where: { id: videoId },
          data: {
            likes: {
              decrement: 1
            }
          }
        });
        
        console.log("Like API - Unlike successful, new count:", result.likes);
        return NextResponse.json({ liked: false, likes: result.likes });
      } else {
        console.log("Like API - Adding like");
        // Like the video
        await prisma.videoLike.create({
          data: {
            userId: userId,
            videoId: videoId
          }
        });
        
        // Increment like count
        result = await prisma.video.update({
          where: { id: videoId },
          data: {
            likes: {
              increment: 1
            }
          }
        });
        
        console.log("Like API - Like successful, new count:", result.likes);
        return NextResponse.json({ liked: true, likes: result.likes });
      }
    } catch (dbError) {
      console.error("Database error during like operation:", dbError);
      console.error("Database error details:", {
        name: (dbError as Error).name,
        message: (dbError as Error).message,
        cause: (dbError as any).cause
      });
      
      // Return current video state on database error
      const currentVideo = await prisma.video.findUnique({
        where: { id: videoId },
        select: { likes: true }
      });
      
      return NextResponse.json(
        { 
          error: "Failed to update like status",
          liked: !!existingLike,
          likes: currentVideo?.likes || video.likes 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error handling like:", error);
    return NextResponse.json(
      { error: "Internal server error", liked: false, likes: 0 },
      { status: 500 }
    );
  }
} 