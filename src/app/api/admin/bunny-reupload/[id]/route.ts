import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteBunnyVideo } from "@/lib/bunny";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[Bunny Re-upload] Starting cleanup for video ${id}`);

    // Get video from database (cast to any to access extended fields)
    const video = await prisma.video.findUnique({
      where: { id }
    }) as any;

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (video.storageType !== 'bunny' || !video.bunnyVideoId) {
      return NextResponse.json({ 
        error: "Video is not stored in Bunny.net" 
      }, { status: 400 });
    }

    console.log(`[Bunny Re-upload] Deleting Bunny video: ${video.bunnyVideoId}`);

    // Delete from Bunny.net
    try {
      await deleteBunnyVideo(video.bunnyVideoId);
      console.log(`[Bunny Re-upload] Successfully deleted from Bunny.net`);
    } catch (error) {
      console.log(`[Bunny Re-upload] Failed to delete from Bunny.net:`, error);
      // Continue anyway - video might already be deleted
    }

    // Clear Bunny.net fields in database (use raw query to avoid type issues)
    await prisma.$executeRaw`
      UPDATE "Video" 
      SET 
        "bunnyVideoId" = NULL,
        "bunnyStreamUrl" = NULL, 
        "bunnyThumbnailUrl" = NULL,
        "storageType" = 'local',
        "filePath" = ${`/videos/${video.id}.mp4`}
      WHERE "id" = ${id}
    `;

    console.log(`[Bunny Re-upload] Database updated successfully`);

    return NextResponse.json({
      success: true,
      message: "Video prepared for re-upload. You can now upload a new video file.",
      video: {
        id: video.id,
        title: video.title,
        storageType: 'local'
      }
    });

  } catch (error) {
    console.error("[Bunny Re-upload] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to prepare video for re-upload",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 