import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { uploadVideo as uploadToCloudinary } from "@/lib/cloudinary";

export async function POST(req: NextRequest) {
  try {
    console.log("[Thumbnail Test] Starting thumbnail upload test");
    
    // Verify admin session
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Process form data
    const formData = await req.formData();
    const videoFile = formData.get("video") as File;

    if (!videoFile) {
      return NextResponse.json(
        { error: "Video file is required" },
        { status: 400 }
      );
    }

    console.log(`[Thumbnail Test] Processing video: ${videoFile.name}`);
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    
    // Test Cloudinary auto-thumbnail generation
    const uploadOptions = {
      folder: 'bubblegum/test',
      public_id: `test_${Date.now()}`,
      eager: [
        {
          width: 640,
          height: 360,
          crop: 'limit',
          quality: 'auto',
          format: 'jpg'
        }
      ],
      eager_async: false // Generate immediately
    };

    console.log("[Thumbnail Test] Uploading with auto-thumbnail generation...");
    const result = await uploadToCloudinary(videoBuffer, uploadOptions);
    
    console.log("[Thumbnail Test] Upload result:", {
      public_id: result.public_id,
      secure_url: result.secure_url,
      eager_count: result.eager?.length || 0,
      eager_urls: result.eager?.map(e => e.secure_url) || []
    });

    return NextResponse.json({
      success: true,
      video: {
        url: result.secure_url,
        public_id: result.public_id
      },
      thumbnails: {
        count: result.eager?.length || 0,
        urls: result.eager?.map(e => e.secure_url) || [],
        details: result.eager || []
      },
      message: "Thumbnail test completed successfully"
    });

  } catch (error) {
    console.error("[Thumbnail Test] Failed:", error);
    return NextResponse.json(
      { 
        error: "Thumbnail test failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
} 