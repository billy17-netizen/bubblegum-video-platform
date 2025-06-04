import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    console.log("[Simple Video Test] Starting basic video test...");
    
    // Get just one video for testing
    const video = await prisma.video.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        googleDriveFileId: true,
        googleDriveVideoUrl: true,
        cloudinaryUrl: true,
        filePath: true
      }
    });

    if (!video) {
      return NextResponse.json({
        error: "No videos found in database",
        solution: "Upload at least one video first"
      });
    }

    // Test basic URL generation
    let testVideoUrl = null;
    let urlType = 'unknown';

    if (video.googleDriveFileId) {
      testVideoUrl = `/api/videos/${video.id}/google-drive-stream`;
      urlType = 'google-drive-proxy';
    } else if (video.cloudinaryUrl) {
      testVideoUrl = video.cloudinaryUrl;
      urlType = 'cloudinary-direct';
    } else if (video.filePath) {
      testVideoUrl = `/api/videos/${video.id}/stream`;
      urlType = 'local-stream';
    }

    // Test URL accessibility
    let urlTest = null;
    if (testVideoUrl) {
      try {
        console.log(`[Simple Video Test] Testing URL: ${testVideoUrl}`);
        
        const testResponse = await fetch(`http://localhost:3000${testVideoUrl}`, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 SimpleVideoTest'
          }
        });

        urlTest = {
          url: testVideoUrl,
          accessible: testResponse.ok,
          status: testResponse.status,
          statusText: testResponse.statusText,
          contentType: testResponse.headers.get('content-type')
        };

      } catch (error) {
        urlTest = {
          url: testVideoUrl,
          accessible: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return NextResponse.json({
      video: {
        id: video.id,
        title: video.title,
        hasGoogleDrive: !!video.googleDriveFileId,
        hasCloudinary: !!video.cloudinaryUrl,
        hasLocalFile: !!video.filePath
      },
      url: {
        generated: testVideoUrl,
        type: urlType
      },
      test: urlTest,
      quickFixes: [
        "1. If URL test fails, check if development server is running",
        "2. For Google Drive videos, verify .env credentials", 
        "3. For local videos, check file exists in public/videos/",
        "4. Try refreshing browser cache",
        "5. Check browser console for JavaScript errors"
      ],
      nextSteps: [
        "1. Copy the 'generated' URL above",
        "2. Paste in browser address bar", 
        "3. Should download or stream the video",
        "4. If 404/500 error, check server logs",
        "5. If CORS error, issue should be fixed with proxy"
      ]
    });

  } catch (error) {
    console.error("[Simple Video Test] Error:", error);
    return NextResponse.json({
      error: "Debug test failed",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 