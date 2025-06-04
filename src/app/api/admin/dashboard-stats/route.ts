import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get total videos count
    const totalVideos = await prisma.video.count();
    
    // Get sum of all views
    const viewsResult = await prisma.video.aggregate({
      _sum: {
        views: true,
      },
    });
    
    // Get sum of all likes
    const likesResult = await prisma.video.aggregate({
      _sum: {
        likes: true,
      },
    });

    const totalViews = viewsResult._sum.views || 0;
    const totalLikes = likesResult._sum.likes || 0;

    return NextResponse.json({
      stats: {
        totalVideos,
        totalViews,
        totalLikes
      }
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 