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
      },
      select: {
        id: true,
        title: true,
        googleDriveFileId: true,
        googleDriveVideoUrl: true,
        createdAt: true
      }
    });

    if (!googleDriveVideo) {
      return NextResponse.json({
        error: "No Google Drive videos found",
        suggestion: "Upload a video using Google Drive bulk upload first"
      });
    }

    const fileId = googleDriveVideo.googleDriveFileId;
    
    // Test different Google Drive URL formats for video streaming
    const urls = {
      directDownload: `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
      alternativeDownload: `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
      legacyDownload: `https://drive.google.com/uc?id=${fileId}&export=download`,
      savedDatabaseUrl: googleDriveVideo.googleDriveVideoUrl,
      previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      proxyUrl: `/api/videos/${googleDriveVideo.id}/google-drive-stream`
    };

    console.log(`[Google Drive Debug] Testing video: ${googleDriveVideo.title}`);
    console.log(`[Google Drive Debug] File ID: ${fileId}`);

    // Test each URL accessibility with lightweight HEAD requests
    const results: Record<string, any> = {};
    
    for (const [urlType, url] of Object.entries(urls)) {
      if (!url) {
        results[urlType] = { status: 'N/A', error: 'URL not available' };
        continue;
      }

      // Skip proxy URL test (it would be circular)
      if (urlType === 'proxyUrl') {
        results[urlType] = { 
          status: 'Available', 
          url: url,
          note: 'Internal proxy endpoint' 
        };
        continue;
      }

      try {
        console.log(`[Google Drive Debug] Testing ${urlType}: ${url}`);
        
        const testResponse = await fetch(url, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const contentType = testResponse.headers.get('content-type') || 'unknown';
        const contentLength = testResponse.headers.get('content-length') || 'unknown';
        
        results[urlType] = {
          status: testResponse.ok ? 'Working' : `Error ${testResponse.status}`,
          httpStatus: testResponse.status,
          contentType: contentType,
          contentLength: contentLength,
          url: url,
          isVideo: contentType.includes('video'),
          isHtml: contentType.includes('html')
        };

        console.log(`[Google Drive Debug] ${urlType} result:`, results[urlType]);

      } catch (error) {
        results[urlType] = {
          status: 'Error',
          error: error instanceof Error ? error.message : 'Unknown error',
          url: url
        };
        console.log(`[Google Drive Debug] ${urlType} error:`, error);
      }
    }

    // Find working video URLs
    const workingUrls = Object.entries(results)
      .filter(([_, result]) => result.status === 'Working' && result.isVideo)
      .map(([urlType, _]) => urlType);

    const htmlUrls = Object.entries(results)
      .filter(([_, result]) => result.status === 'Working' && result.isHtml)
      .map(([urlType, _]) => urlType);

    return NextResponse.json({
      video: {
        id: googleDriveVideo.id,
        title: googleDriveVideo.title,
        fileId: fileId,
        createdAt: googleDriveVideo.createdAt
      },
      urlTests: results,
      summary: {
        workingVideoUrls: workingUrls,
        htmlResponseUrls: htmlUrls,
        totalUrlsTested: Object.keys(urls).length - 1, // Exclude proxy URL
        recommendedStreamingUrl: workingUrls.length > 0 ? 
          `/api/videos/${googleDriveVideo.id}/google-drive-stream` : 
          'No working direct URLs found - check file permissions'
      },
      troubleshooting: {
        ifNoWorkingUrls: [
          "1. Ensure the video file is set to 'Anyone with the link can view'",
          "2. Check if the file was uploaded correctly to Google Drive", 
          "3. Verify Google Drive API credentials are working",
          "4. Try re-uploading the video"
        ],
        ifHtmlResponse: [
          "HTML responses usually indicate Google Drive virus scan warnings",
          "This happens with large files that can't be scanned",
          "The proxy endpoint should handle these cases automatically"
        ]
      }
    });

  } catch (error) {
    console.error("[Google Drive Debug] Error:", error);
    return NextResponse.json({
      error: "Failed to debug Google Drive video",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 