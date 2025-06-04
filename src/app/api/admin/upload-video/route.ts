import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { nanoid } from "nanoid";
import sharp from "sharp";
import { 
  compressVideoSafe as compressVideoInPlace, 
  shouldCompressVideoBasic as shouldCompressVideo, 
  getBasicVideoMetadata as getVideoMetadata
} from "@/lib/videoService.server.alternative";

// Keep the VideoCompressionOptions interface
export interface VideoCompressionOptions {
  quality?: 'low' | 'medium' | 'high';
  maxFileSizeMB?: number;
}

export async function POST(req: NextRequest) {
  try {
    console.log("[Upload] Starting video upload process");
    
    // Verify admin session with authOptions
    const session = await getServerSession(authOptions);
    console.log("[Upload] Session check:", session ? "Session found" : "No session");
    
    if (!session?.user) {
      console.error("[Upload] No session found");
      return NextResponse.json({ error: "Unauthorized: No session" }, { status: 401 });
    }
    
    if (session.user.role !== "ADMIN") {
      console.error("[Upload] Not admin role:", session.user.role);
      return NextResponse.json({ error: "Unauthorized: Not admin" }, { status: 401 });
    }
    
    // Add console log to debug session
    console.log("[Upload] Session user:", {
      id: session.user.id,
      username: session.user.username,
      role: session.user.role
    });

    // Verify that the admin actually exists in the database
    console.log("[Upload] Verifying admin exists in database...");
    const adminExists = await prisma.admin.findUnique({
      where: { id: session.user.id },
      select: { id: true, username: true }
    });

    if (!adminExists) {
      console.error("[Upload] Admin not found in database:", session.user.id);
      console.error("[Upload] This usually means the session is stale after a database reset");
      return NextResponse.json(
        { 
          error: "Admin account not found in database. Please log out and log back in.",
          details: "Your session references an admin ID that no longer exists. This can happen after database resets."
        },
        { status: 401 }
      );
    }

    console.log("[Upload] Admin verified:", adminExists);

    // Process the form data
    console.log("[Upload] Processing form data...");
    const formData = await req.formData();
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const videoFile = formData.get("video") as File;
    const thumbnailFile = formData.get("thumbnail") as File | null;

    console.log("[Upload] Form data received:", {
      title: title || "No title",
      description: description || "No description", 
      videoFile: videoFile ? `${videoFile.name} (${videoFile.size} bytes)` : "No video file",
      thumbnailFile: thumbnailFile ? `${thumbnailFile.name} (${thumbnailFile.size} bytes)` : "No thumbnail"
    });

    if (!title || !videoFile) {
      console.error("[Upload] Missing required fields:", { title: !!title, videoFile: !!videoFile });
      return NextResponse.json(
        { error: "Title and video are required" },
        { status: 400 }
      );
    }

    // Check if a video with the same title already exists for this admin
    console.log("[Upload] Checking for duplicate video titles...");
    console.log(`[Upload] Searching for: title="${title.trim()}", adminId="${session.user.id}"`);
    
    const existingVideo = await prisma.video.findFirst({
      where: {
        title: title.trim(),
        adminId: session.user.id
      }
    });

    if (existingVideo) {
      console.error("[Upload] Duplicate video title found:");
      console.error(`[Upload] Existing video ID: ${existingVideo.id}`);
      console.error(`[Upload] Existing video title: "${existingVideo.title}"`);
      console.error(`[Upload] Attempted title: "${title}"`);
      console.error(`[Upload] Admin ID: ${session.user.id}`);
      
      return NextResponse.json(
        { 
          error: "A video with this title already exists. Please choose a different title.",
          details: `Video "${title}" already exists. Please use a unique title.`,
          existingVideoId: existingVideo.id
        },
        { status: 409 }
      );
    }

    console.log("[Upload] No duplicate found, proceeding with upload...");

    try {
      // Create unique filenames
      const videoId = randomUUID();
      const videoExt = videoFile.name.split(".").pop();
      const videoFilename = `${videoId}.${videoExt}`;
      
      console.log("[Upload] Generated filenames:", { videoId, videoExt, videoFilename });
      
      // Ensure directories exist
      const videosDir = path.join(process.cwd(), "public", "videos");
      const thumbnailsDir = path.join(process.cwd(), "public", "thumbnails");
      
      console.log("[Upload] Directory paths:", { videosDir, thumbnailsDir });
      
      // Create directories if they don't exist
      if (!fs.existsSync(videosDir)) {
        console.log(`[Upload] Creating videos directory: ${videosDir}`);
        await mkdir(videosDir, { recursive: true });
      }
      
      if (!fs.existsSync(thumbnailsDir)) {
        console.log(`[Upload] Creating thumbnails directory: ${thumbnailsDir}`);
        await mkdir(thumbnailsDir, { recursive: true });
      }
      
      const videoPath = path.join(videosDir, videoFilename);
      console.log(`[Upload] Saving video to: ${videoPath}`);

      // Save the video file
      console.log("[Upload] Converting video file to buffer...");
      const videoArrayBuffer = await videoFile.arrayBuffer();
      const videoBuffer = Buffer.from(videoArrayBuffer);
      console.log(`[Upload] Video buffer size: ${videoBuffer.length} bytes`);
      
      console.log("[Upload] Writing video file...");
      await writeFile(videoPath, videoBuffer);
      
      // Verify the file was saved successfully
      if (!fs.existsSync(videoPath)) {
        console.error(`[Upload] Failed to save video file to ${videoPath}`);
        return NextResponse.json(
          { error: "Failed to save video file" },
          { status: 500 }
        );
      }
      console.log("[Upload] Video file saved successfully");

      // Check if video needs compression and compress if necessary
      console.log("[Upload] Checking if video needs compression...");
      const compressionCheck = await shouldCompressVideo(videoPath, {
        maxSizeMB: 50 // Only file size checking in basic version
      });
      
      let compressionResult = null;
      if (compressionCheck.shouldCompress) {
        console.log(`[Upload] Video needs compression: ${compressionCheck.reason}`);
        console.log(`[Upload] Original metadata:`, compressionCheck.metadata);
        
        // Set compression options based on original video size/quality
        const compressionOptions: VideoCompressionOptions = {
          quality: 'medium', // Default to medium quality
          maxFileSizeMB: 25   // Target max 25MB after compression
        };
        
        // Adjust quality based on original file size
        const originalSizeMB = compressionCheck.metadata?.fileSize ? 
          compressionCheck.metadata.fileSize / 1024 / 1024 : 0;
        
        if (originalSizeMB > 200) {
          compressionOptions.quality = 'low';
          compressionOptions.maxFileSizeMB = 15;
        } else if (originalSizeMB > 100) {
          compressionOptions.quality = 'medium';
          compressionOptions.maxFileSizeMB = 20;
        } else {
          compressionOptions.quality = 'high';
          compressionOptions.maxFileSizeMB = 30;
        }
        
        console.log(`[Upload] Compressing video with options:`, compressionOptions);
        compressionResult = await compressVideoInPlace(videoPath, compressionOptions);
        
        if (compressionResult.success) {
          console.log(`[Upload] Video compression successful!`);
          console.log(`[Upload] Size reduced from ${(compressionResult.originalSize! / 1024 / 1024).toFixed(2)}MB to ${(compressionResult.compressedSize! / 1024 / 1024).toFixed(2)}MB`);
          console.log(`[Upload] Compression ratio: ${compressionResult.compressionRatio!.toFixed(1)}%`);
        } else {
          console.warn(`[Upload] Video compression failed: ${compressionResult.error}`);
          console.warn(`[Upload] Continuing with original video file...`);
        }
      } else {
        console.log(`[Upload] Video compression not needed: ${compressionCheck.reason}`);
      }

      // Handle thumbnail - upload if provided
      let thumbnailFilename = null;
      if (thumbnailFile) {
        console.log("[Upload] Processing uploaded thumbnail...");
        const thumbnailExt = thumbnailFile.name.split(".").pop();
        thumbnailFilename = `${videoId}_thumbnail.${thumbnailExt}`;
        const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);
        console.log(`[Upload] Saving thumbnail to: ${thumbnailPath}`);

        const thumbnailArrayBuffer = await thumbnailFile.arrayBuffer();
        const thumbnailBuffer = Buffer.from(thumbnailArrayBuffer);
        await writeFile(thumbnailPath, thumbnailBuffer);
        
        // Verify the thumbnail was saved successfully
        if (!fs.existsSync(thumbnailPath)) {
          console.error(`[Upload] Failed to save thumbnail file to ${thumbnailPath}`);
        } else {
          console.log("[Upload] Thumbnail file saved successfully");
        }
      } else {
        console.log("[Upload] No thumbnail provided, continuing without thumbnail");
      }

      // Create video record in database with consistent path format
      console.log("[Upload] Creating video record in database...");
      const video = await prisma.video.create({
        data: {
          title,
          description,
          filePath: `/videos/${videoFilename}`,
          thumbnail: thumbnailFilename
            ? `/thumbnails/${thumbnailFilename}`
            : null,
          adminId: session.user.id,
        },
      });
      
      console.log(`[Upload] Video created in database: ${video.id}, filePath: ${video.filePath}`);

      return NextResponse.json({
        success: true,
        video: {
          id: video.id,
          title: video.title,
          description: video.description,
          filePath: video.filePath,
          thumbnail: video.thumbnail
        },
        thumbnailInfo: {
          wasProvided: !!thumbnailFile,
          wasAutoGenerated: !thumbnailFile && !!thumbnailFilename,
          path: video.thumbnail
        },
        compression: compressionResult ? {
          wasCompressed: compressionResult.success,
          originalSizeMB: compressionResult.originalSize ? (compressionResult.originalSize / 1024 / 1024).toFixed(2) : null,
          compressedSizeMB: compressionResult.compressedSize ? (compressionResult.compressedSize / 1024 / 1024).toFixed(2) : null,
          compressionRatio: compressionResult.compressionRatio ? compressionResult.compressionRatio.toFixed(1) + '%' : null,
          error: compressionResult.error || null
        } : {
          wasCompressed: false,
          reason: compressionCheck.reason
        }
      });
      
    } catch (fileError) {
      console.error("[Upload] File processing error:", fileError);
      throw fileError;
    }
    
  } catch (error) {
    console.error("[Upload] Detailed error information:");
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    console.error("Error type:", typeof error);
    console.error("Full error object:", error);
    
    // Check for specific error types
    if (error && typeof error === 'object') {
      if ('code' in error) {
        console.error("Error code:", (error as any).code);
      }
      if ('syscall' in error) {
        console.error("System call:", (error as any).syscall);
      }
      if ('errno' in error) {
        console.error("Error number:", (error as any).errno);
      }
      if ('path' in error) {
        console.error("Error path:", (error as any).path);
      }
    }
    
    return NextResponse.json(
      { 
        error: "Failed to upload video",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 