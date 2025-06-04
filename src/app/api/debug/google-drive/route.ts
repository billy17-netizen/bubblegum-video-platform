import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    // Get the latest Google Drive video
    const googleDriveVideo = await prisma.video.findFirst({
      where: {
        OR: [
          { googleDriveFileId: { not: null } },
          { googleDriveVideoUrl: { not: null } }
        ]
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!googleDriveVideo) {
      return NextResponse.json({
        error: "No Google Drive videos found",
        suggestion: "Upload a video using Google Drive first"
      });
    }

    const fileId = googleDriveVideo.googleDriveFileId;
    const videoUrl = googleDriveVideo.googleDriveVideoUrl;
    
    // Test different Google Drive URL formats
    const urls = {
      directDownload: `https://drive.google.com/uc?export=download&id=${fileId}`,
      streamingUrl: `https://drive.google.com/uc?export=stream&id=${fileId}`,
      embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      viewUrl: `https://drive.google.com/file/d/${fileId}/view`,
      savedUrl: videoUrl
    };

    // Test each URL accessibility
    const results: Record<string, any> = {};
    
    for (const [name, url] of Object.entries(urls)) {
      if (!url) {
        results[name] = { status: "N/A", error: "URL not available" };
        continue;
      }

      try {
        const response = await fetch(url, { 
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        results[name] = {
          status: response.status,
          statusText: response.statusText,
          accessible: response.ok,
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length')
        };
      } catch (error) {
        results[name] = {
          status: "Error",
          error: error instanceof Error ? error.message : String(error),
          accessible: false
        };
      }
    }

    return NextResponse.json({
      video: {
        id: googleDriveVideo.id,
        title: googleDriveVideo.title,
        fileId: fileId,
        savedUrl: videoUrl
      },
      urlTests: results,
      recommendations: [
        "If all URLs return 403/401, the file is not public",
        "If directDownload works, use it for video src",
        "Make sure file is shared as 'Anyone with link can view'"
      ]
    });

  } catch (error) {
    console.error("Google Drive debug error:", error);
    return NextResponse.json({
      error: "Failed to debug Google Drive",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 