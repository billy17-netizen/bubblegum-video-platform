import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { uploadImage, deleteResource } from "@/lib/cloudinary";
import { writeFile, unlink } from "fs/promises";
import path from "path";

// Update thumbnail
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get video to check its storage type
    const video = await prisma.video.findUnique({
      where: { id: id },
      select: {
        id: true,
        cloudinaryPublicId: true,
        thumbnailPublicId: true,
        thumbnail: true,
        thumbnailUrl: true
      }
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Process the form data
    const formData = await request.formData();
    const thumbnailFile = formData.get("thumbnail") as File;

    if (!thumbnailFile) {
      return NextResponse.json({ error: "Thumbnail file is required" }, { status: 400 });
    }

    console.log(`[Thumbnail Update] Processing thumbnail for video: ${id}`);
    console.log(`[Thumbnail Update] File size: ${thumbnailFile.size} bytes`);

    const isCloudinaryVideo = !!video.cloudinaryPublicId;
    let newThumbnailUrl = null;
    let newThumbnailPublicId = null;
    const oldThumbnailPath = null;

    // Convert file to buffer
    const thumbnailArrayBuffer = await thumbnailFile.arrayBuffer();
    const thumbnailBuffer = Buffer.from(thumbnailArrayBuffer);

    if (isCloudinaryVideo) {
      // Upload to Cloudinary
      console.log(`[Thumbnail Update] Uploading to Cloudinary...`);
      
      // Delete old Cloudinary thumbnail if exists
      if (video.thumbnailPublicId) {
        try {
          await deleteResource(video.thumbnailPublicId, 'image');
          console.log(`[Thumbnail Update] Deleted old Cloudinary thumbnail: ${video.thumbnailPublicId}`);
        } catch (error) {
          console.warn(`[Thumbnail Update] Failed to delete old Cloudinary thumbnail:`, error);
        }
      }

      const uploadResult = await uploadImage(thumbnailBuffer, {
        folder: 'bubblegum/thumbnails',
        public_id: `${video.cloudinaryPublicId}_thumbnail`,
        preserveAspectRatio: false // Use legacy sizing for manual uploads
      });

      newThumbnailUrl = uploadResult.secure_url;
      newThumbnailPublicId = uploadResult.public_id;

      console.log(`[Thumbnail Update] Cloudinary upload successful:`, {
        publicId: newThumbnailPublicId,
        url: newThumbnailUrl
      });
    } else {
      // Save locally
      console.log(`[Thumbnail Update] Saving to local storage...`);
      
      // Delete old local thumbnail if exists
      if (video.thumbnail) {
        const oldPath = path.join(process.cwd(), 'public', video.thumbnail);
        try {
          await unlink(oldPath);
          console.log(`[Thumbnail Update] Deleted old local thumbnail: ${oldPath}`);
        } catch (error) {
          console.warn(`[Thumbnail Update] Failed to delete old local thumbnail:`, error);
        }
      }

      const timestamp = Date.now();
      const fileExtension = thumbnailFile.name.split('.').pop() || 'jpg';
      const fileName = `thumbnail_${id}_${timestamp}.${fileExtension}`;
      const filePath = path.join(process.cwd(), 'public', 'uploads', 'thumbnails', fileName);
      
      // Ensure upload directory exists
      const uploadDir = path.dirname(filePath);
      const { mkdir } = require('fs/promises');
      await mkdir(uploadDir, { recursive: true });
      
      await writeFile(filePath, thumbnailBuffer);
      
      newThumbnailUrl = `/uploads/thumbnails/${fileName}`;
      console.log(`[Thumbnail Update] Local save successful: ${newThumbnailUrl}`);
    }

    // Update database
    const updatedVideo = await prisma.video.update({
      where: { id: id },
      data: {
        thumbnail: !isCloudinaryVideo ? newThumbnailUrl : video.thumbnail,
        thumbnailUrl: isCloudinaryVideo ? newThumbnailUrl : null,
        thumbnailPublicId: isCloudinaryVideo ? newThumbnailPublicId : null,
      },
      select: {
        id: true,
        title: true,
        thumbnail: true,
        thumbnailUrl: true,
        thumbnailPublicId: true,
        cloudinaryPublicId: true
      }
    });

    console.log(`[Thumbnail Update] Database updated for video: ${id}`);

    return NextResponse.json({
      success: true,
      thumbnail: {
        url: newThumbnailUrl,
        publicId: newThumbnailPublicId,
        storageType: isCloudinaryVideo ? 'cloudinary' : 'local'
      },
      video: updatedVideo
    });

  } catch (error) {
    console.error("Error updating thumbnail:", error);
    return NextResponse.json(
      { error: `Failed to update thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// Delete thumbnail
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get video to check its storage type and current thumbnail
    const video = await prisma.video.findUnique({
      where: { id: id },
      select: {
        id: true,
        cloudinaryPublicId: true,
        thumbnailPublicId: true,
        thumbnail: true,
        thumbnailUrl: true
      }
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    console.log(`[Thumbnail Delete] Deleting thumbnail for video: ${id}`);

    const isCloudinaryVideo = !!video.cloudinaryPublicId;

    if (isCloudinaryVideo && video.thumbnailPublicId) {
      // Delete from Cloudinary
      try {
        await deleteResource(video.thumbnailPublicId, 'image');
        console.log(`[Thumbnail Delete] Deleted Cloudinary thumbnail: ${video.thumbnailPublicId}`);
      } catch (error) {
        console.error(`[Thumbnail Delete] Failed to delete from Cloudinary:`, error);
        // Continue with database update even if Cloudinary delete fails
      }
    } else if (!isCloudinaryVideo && video.thumbnail) {
      // Delete local file
      const thumbnailPath = path.join(process.cwd(), 'public', video.thumbnail);
      try {
        await unlink(thumbnailPath);
        console.log(`[Thumbnail Delete] Deleted local thumbnail: ${thumbnailPath}`);
      } catch (error) {
        console.warn(`[Thumbnail Delete] Failed to delete local file:`, error);
        // Continue with database update even if file delete fails
      }
    }

    // Update database to remove thumbnail references
    const updatedVideo = await prisma.video.update({
      where: { id: id },
      data: {
        thumbnail: null,
        thumbnailUrl: null,
        thumbnailPublicId: null,
      },
      select: {
        id: true,
        title: true,
        thumbnail: true,
        thumbnailUrl: true,
        thumbnailPublicId: true,
        cloudinaryPublicId: true
      }
    });

    console.log(`[Thumbnail Delete] Database updated for video: ${id}`);

    return NextResponse.json({
      success: true,
      message: "Thumbnail deleted successfully",
      video: updatedVideo
    });

  } catch (error) {
    console.error("Error deleting thumbnail:", error);
    return NextResponse.json(
      { error: `Failed to delete thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
} 