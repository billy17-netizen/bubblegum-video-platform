import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { uploadVideo as uploadVideoToCloudinary, uploadImage, uploadImagePreserveAspectRatio } from "@/lib/cloudinary";
import { getCloudinaryAutoThumbnailUrl } from "@/lib/autoThumbnail";

// Auto thumbnail enabled for Cloudinary upload
const ENABLE_AUTO_THUMBNAIL = true;

export async function POST(req: NextRequest) {
  try {
    console.log("[Cloudinary Upload] Starting video upload process");
    
    // Verify admin session
    const session = await getServerSession(authOptions);
    console.log("[Cloudinary Upload] Session check:", session ? "Session found" : "No session");
    
    if (!session?.user) {
      console.error("[Cloudinary Upload] No session found");
      return NextResponse.json({ error: "Unauthorized: No session" }, { status: 401 });
    }
    
    if (session.user.role !== "ADMIN") {
      console.error("[Cloudinary Upload] Not admin role:", session.user.role);
      return NextResponse.json({ error: "Unauthorized: Not admin" }, { status: 401 });
    }

    console.log("[Cloudinary Upload] Session user:", {
      id: session.user.id,
      username: session.user.username,
      role: session.user.role
    });

    // Verify that the admin actually exists in the database
    console.log("[Cloudinary Upload] Verifying admin exists in database...");
    const adminExists = await prisma.admin.findUnique({
      where: { id: session.user.id },
      select: { id: true, username: true }
    });

    if (!adminExists) {
      console.error("[Cloudinary Upload] Admin not found in database:", session.user.id);
      console.error("[Cloudinary Upload] This usually means the session is stale after a database reset");
      return NextResponse.json(
        { 
          error: "Admin account not found in database. Please log out and log back in.",
          details: "Your session references an admin ID that no longer exists. This can happen after database resets."
        },
        { status: 401 }
      );
    }

    console.log("[Cloudinary Upload] Admin verified:", adminExists);

    // Process the form data
    console.log("[Cloudinary Upload] Processing form data...");
    const formData = await req.formData();
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const videoFile = formData.get("video") as File;
    const thumbnailFile = formData.get("thumbnail") as File | null;

    console.log("[Cloudinary Upload] Form data received:", {
      title: title || "No title",
      description: description || "No description", 
      videoFile: videoFile ? `${videoFile.name} (${videoFile.size} bytes)` : "No video file",
      thumbnailFile: thumbnailFile ? `${thumbnailFile.name} (${thumbnailFile.size} bytes)` : "No thumbnail"
    });

    if (!title || !videoFile) {
      console.error("[Cloudinary Upload] Missing required fields:", { title: !!title, videoFile: !!videoFile });
      return NextResponse.json(
        { error: "Title and video are required" },
        { status: 400 }
      );
    }

    // Check if a video with the same title already exists for this admin
    console.log("[Cloudinary Upload] Checking for duplicate video titles...");
    console.log(`[Cloudinary Upload] Searching for: title="${title.trim()}", adminId="${session.user.id}"`);
    
    const existingVideo = await prisma.video.findFirst({
      where: {
        title: title.trim(),
        adminId: session.user.id
      }
    });

    if (existingVideo) {
      console.error("[Cloudinary Upload] Duplicate video title found:");
      console.error(`[Cloudinary Upload] Existing video ID: ${existingVideo.id}`);
      console.error(`[Cloudinary Upload] Existing video title: "${existingVideo.title}"`);
      console.error(`[Cloudinary Upload] Attempted title: "${title}"`);
      console.error(`[Cloudinary Upload] Admin ID: ${session.user.id}`);
      
      return NextResponse.json(
        { 
          error: "A video with this title already exists. Please choose a different title.",
          details: `Video "${title}" already exists. Please use a unique title.`,
          existingVideoId: existingVideo.id
        },
        { status: 409 }
      );
    }

    console.log("[Cloudinary Upload] No duplicate found, proceeding with upload...");

    console.log(`[Cloudinary Upload] Starting upload for: ${title}`);
    console.log(`[Cloudinary Upload] Video file size: ${videoFile.size} bytes`);

    // Check Cloudinary configuration
    const cloudinaryConfig = {
      cloud_name: !!process.env.CLOUDINARY_CLOUD_NAME,
      api_key: !!process.env.CLOUDINARY_API_KEY,
      api_secret: !!process.env.CLOUDINARY_API_SECRET,
    };
    console.log("[Cloudinary Upload] Config check:", cloudinaryConfig);
    
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error("[Cloudinary Upload] Missing Cloudinary environment variables");
      console.error("[Cloudinary Upload] Please set up Cloudinary credentials in .env file");
      console.error("[Cloudinary Upload] Required variables: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET");
      
      return NextResponse.json(
        { 
          error: "Cloudinary configuration missing",
          details: "Please set up Cloudinary credentials in .env file or use Local Storage instead",
          missingVars: [
            !process.env.CLOUDINARY_CLOUD_NAME ? "CLOUDINARY_CLOUD_NAME" : null,
            !process.env.CLOUDINARY_API_KEY ? "CLOUDINARY_API_KEY" : null,
            !process.env.CLOUDINARY_API_SECRET ? "CLOUDINARY_API_SECRET" : null
          ].filter(Boolean),
          suggestion: "Switch to 'Local Storage' option in the upload form for immediate testing"
        },
        { status: 400 }
      );
    }

    try {
      // Convert video file to buffer
      console.log("[Cloudinary Upload] Converting video file to buffer...");
      const videoArrayBuffer = await videoFile.arrayBuffer();
      const videoBuffer = Buffer.from(videoArrayBuffer);
      console.log(`[Cloudinary Upload] Video buffer size: ${videoBuffer.length} bytes`);

      // Upload video to Cloudinary
      console.log(`[Cloudinary Upload] Uploading video to Cloudinary...`);
      const videoUploadResult = await uploadVideoToCloudinary(videoBuffer, {
        folder: 'bubblegum/videos',
        quality: 'auto',
        format: 'mp4'
      });

      console.log(`[Cloudinary Upload] Video uploaded successfully:`, {
        publicId: videoUploadResult.public_id,
        url: videoUploadResult.secure_url,
        duration: videoUploadResult.duration,
        size: videoUploadResult.bytes
      });

      // Upload thumbnail to Cloudinary if provided
      let thumbnailUploadResult = null;
      let thumbnailSource = null;

      console.log(`[DEBUG] Thumbnail decision logic:`);
      console.log(`[DEBUG] - thumbnailFile:`, !!thumbnailFile);
      console.log(`[DEBUG] - Auto thumbnail enabled for Cloudinary upload`);

      if (thumbnailFile) {
        console.log(`[Cloudinary Upload] Uploading provided thumbnail to Cloudinary...`);
        try {
          const thumbnailArrayBuffer = await thumbnailFile.arrayBuffer();
          const thumbnailBuffer = Buffer.from(thumbnailArrayBuffer);
          
          thumbnailUploadResult = await uploadImagePreserveAspectRatio(thumbnailBuffer, {
            folder: 'bubblegum/thumbnails',
            public_id: `${(videoUploadResult as any).public_id}_thumbnail`
          });
          
          thumbnailSource = 'user-provided';
          console.log(`[Cloudinary Upload] Thumbnail uploaded successfully: ${thumbnailUploadResult.public_id}`);
        } catch (thumbnailError) {
          console.error("[Cloudinary Upload] Thumbnail upload failed:", thumbnailError);
          thumbnailUploadResult = null;
          thumbnailSource = null;
        }
      } else if (ENABLE_AUTO_THUMBNAIL) {
        console.log(`[Cloudinary Upload] Using Cloudinary auto-generated thumbnail`);
        thumbnailSource = 'auto-generated';
        // Cloudinary auto-generates thumbnails from videos, we'll use that URL
        const autoThumbnailUrl = getCloudinaryAutoThumbnailUrl((videoUploadResult as any).public_id);
        thumbnailUploadResult = {
          public_id: `${(videoUploadResult as any).public_id}_auto_thumbnail`,
          secure_url: autoThumbnailUrl,
          url: autoThumbnailUrl
        };
      } else {
        console.log(`[Cloudinary Upload] No thumbnail provided and auto-generation disabled`);
      }

      // Create video record in database with Cloudinary URLs
      console.log("[Cloudinary Upload] Creating video record in database...");
      const video = await prisma.video.create({
        data: {
          title,
          description,
          // Keep legacy fields for backward compatibility (empty for new uploads)
          filePath: '', // Empty since we're using Cloudinary
          thumbnail: thumbnailUploadResult?.secure_url || null,
          
          // New Cloudinary fields
          cloudinaryPublicId: (videoUploadResult as any).public_id,
          cloudinaryUrl: (videoUploadResult as any).secure_url,
          thumbnailPublicId: thumbnailUploadResult?.public_id || null,
          thumbnailUrl: thumbnailUploadResult?.secure_url || null,
          
          adminId: session.user.id,
        },
      });
      
      console.log(`[Cloudinary Upload] Video created in database:`, {
        id: video.id,
        title: video.title,
        cloudinaryPublicId: video.cloudinaryPublicId,
        cloudinaryUrl: video.cloudinaryUrl
      });

      return NextResponse.json({
        success: true,
        message: `Video uploaded successfully to Cloudinary${thumbnailUploadResult ? ` with ${thumbnailSource} thumbnail` : ''}`,
        data: {
          video: {
            id: (videoUploadResult as any).public_id,
            url: (videoUploadResult as any).secure_url,
            duration: (videoUploadResult as any).duration,
            width: (videoUploadResult as any).width,
            height: (videoUploadResult as any).height,
            format: (videoUploadResult as any).format,
            bytes: (videoUploadResult as any).bytes
          },
          thumbnail: thumbnailUploadResult ? {
            id: thumbnailUploadResult.public_id,
            url: thumbnailUploadResult.secure_url,
            width: (thumbnailUploadResult as any).width,
            height: (thumbnailUploadResult as any).height,
            format: (thumbnailUploadResult as any).format,
            bytes: (thumbnailUploadResult as any).bytes,
            source: thumbnailSource
          } : null
        }
      });
      
    } catch (uploadError) {
      console.error("[Cloudinary Upload] Upload process error:", uploadError);
      throw uploadError;
    }
    
  } catch (error) {
    console.error("[Cloudinary Upload] Detailed error information:");
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    console.error("Error type:", typeof error);
    console.error("Full error object:", error);
    
    // Check for specific error types
    if (error && typeof error === 'object') {
      if ('code' in error) {
        console.error("Error code:", (error as any).code);
      }
      if ('http_code' in error) {
        console.error("HTTP code:", (error as any).http_code);
      }
      if ('message' in error) {
        console.error("Error message:", (error as any).message);
      }
    }
    
    return NextResponse.json(
      { error: `Failed to upload video: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
} 