import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSafeThumbnailUrl, getSafeVideoUrl, getVideoStorageType } from "@/lib/videoService.client";

export async function GET() {
  try {
    console.log("Fetching liked videos");
    
    // Get the user's session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      console.log("Unauthorized: No session or user");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("User from session:", {
      id: session.user.id,
      username: session.user.username
    });

    // Fetch user data to get their ID
    let user;
    try {
      user = await prisma.user.findUnique({
        where: {
          id: session.user.id as string,
        },
      });
      
      if (!user && session.user.username) {
        console.log("User not found by ID, trying username lookup");
        user = await prisma.user.findUnique({
          where: {
            username: session.user.username as string,
          },
        });
      }
      
      console.log("User found:", user ? `ID: ${user.id}, username: ${user.username}` : "Not found");
      
      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }
    } catch (dbError) {
      console.error("Database error looking up user:", dbError);
      return NextResponse.json(
        { error: "Database error when finding user" },
        { status: 500 }
      );
    }

    // Fetch videos liked by the user using the VideoLike model
    try {
      console.log(`Fetching videos liked by user ${user.id}`);
      
      const likedVideos = await prisma.videoLike.findMany({
        where: {
          userId: user.id,
        },
        include: {
          video: {
            select: {
              id: true,
              title: true,
              thumbnail: true,
              likes: true,
              filePath: true,
              description: true,
              cloudinaryPublicId: true,
              cloudinaryUrl: true,
              thumbnailPublicId: true,
              thumbnailUrl: true,
            },
          },
        },
      });
      
      console.log(`Found ${likedVideos.length} liked videos`);

      // Format the response to include video data with enriched URLs
      const videos = likedVideos.map((like) => {
        const video = like.video;
        return {
          id: video.id,
          title: video.title,
          thumbnail: getSafeThumbnailUrl(video as any),
          filePath: getSafeVideoUrl(video as any),
          description: video.description,
          likes: video.likes,
          storageType: getVideoStorageType(video as any),
        };
      });

      return NextResponse.json({ videos });
    } catch (queryError) {
      console.error("Error querying liked videos:", queryError);
      return NextResponse.json(
        { error: "Failed to fetch liked videos from database" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error fetching liked videos:", error);
    return NextResponse.json(
      { error: "Failed to fetch liked videos" },
      { status: 500 }
    );
  }
} 