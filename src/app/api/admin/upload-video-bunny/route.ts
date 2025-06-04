import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadVideo, uploadImage } from '@/lib/bunny';
import { getBunnyAutoThumbnailUrl } from '@/lib/autoThumbnail';

// Auto thumbnail enabled for Bunny upload
const ENABLE_AUTO_THUMBNAIL = true;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const thumbnailFile = formData.get('thumbnail') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;

    if (!title || !videoFile) {
      return NextResponse.json({ error: 'Title and video are required' }, { status: 400 });
    }

    // Convert files to buffers
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    
    // Upload video to Bunny.net
    console.log("[Bunny Upload] Uploading video to Bunny.net...");
    const videoUploadResult = await uploadVideo(videoBuffer, {
      title: title
    });

    // Upload thumbnail to Bunny.net if provided
    let thumbnailUploadResult = null;
    let thumbnailSource = null;

    if (thumbnailFile) {
      console.log("[Bunny Upload] Uploading provided thumbnail to Bunny.net...");
      const thumbnailBuffer = Buffer.from(await thumbnailFile.arrayBuffer());
      thumbnailUploadResult = await uploadImage(thumbnailBuffer, {
        fileName: `${title.replace(/[^a-zA-Z0-9]/g, '_')}_thumbnail.jpg`
      });
      thumbnailSource = 'user-provided';
    } else if (ENABLE_AUTO_THUMBNAIL) {
      console.log("[Bunny Upload] Using Bunny.net auto-generated thumbnail...");
      // Bunny.net automatically generates thumbnails for videos
      const libraryId = process.env.BUNNY_LIBRARY_ID;
      if (libraryId) {
        const autoThumbnailUrl = getBunnyAutoThumbnailUrl(videoUploadResult.public_id, libraryId);
        thumbnailUploadResult = {
          public_id: `${videoUploadResult.public_id}_auto_thumbnail`,
          secure_url: autoThumbnailUrl,
          url: autoThumbnailUrl
        };
        thumbnailSource = 'auto-generated';
      }
    }

    // Create video record in database
    console.log("[Bunny Upload] Creating video record in database...");
    const video = await prisma.video.create({
      data: {
        title,
        description,
        filePath: '', // Empty for Bunny.net
        thumbnail: thumbnailUploadResult?.secure_url || null,
        
        // Bunny.net fields
        bunnyVideoId: videoUploadResult.public_id,
        bunnyStreamUrl: videoUploadResult.secure_url,
        bunnyThumbnailUrl: thumbnailUploadResult?.secure_url || null,
        
        // Storage metadata
        storageType: 'bunny',
        originalFileName: videoFile.name,
        fileSize: BigInt(videoFile.size),
        
        adminId: session.user.id,
      },
    });
    
    console.log(`[Bunny Upload] Video created successfully: ${video.id}`);

    return NextResponse.json({
      success: true,
      message: `Video uploaded successfully to Bunny.net${thumbnailUploadResult ? ' with thumbnail' : ''}`,
      data: {
        video: {
          id: video.id,
          title: video.title,
          description: video.description,
          bunnyVideoId: video.bunnyVideoId,
          bunnyStreamUrl: video.bunnyStreamUrl,
          bunnyThumbnailUrl: video.bunnyThumbnailUrl,
          storageType: video.storageType,
          createdAt: video.createdAt
        },
        thumbnailInfo: {
          wasProvided: !!thumbnailFile,
          wasUploaded: !!thumbnailUploadResult,
          source: thumbnailSource
        }
      }
    });

  } catch (error) {
    console.error("[Bunny Upload] Error:", error);
    return NextResponse.json(
      { 
        error: "Upload failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}