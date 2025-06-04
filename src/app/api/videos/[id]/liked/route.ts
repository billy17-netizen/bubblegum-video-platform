import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    // If user is not logged in, return not liked instead of error
    if (!session || !session.user) {
      return NextResponse.json({ liked: false });
    }
    
    const { id: videoId } = await params;
    const userId = session.user.id;
    
    // Check if user already liked the video
    const existingLike = await prisma.videoLike.findUnique({
      where: {
        userId_videoId: {
          userId,
          videoId
        }
      }
    });
    
    return NextResponse.json({ liked: !!existingLike });
  } catch (error) {
    console.error("Error checking like status:", error);
    // Return false instead of error for better UX
    return NextResponse.json({ liked: false });
  }
} 