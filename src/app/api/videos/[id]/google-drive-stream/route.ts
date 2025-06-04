import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get video from database
    const video = await prisma.video.findUnique({
      where: { id },
      select: {
        googleDriveFileId: true,
        googleDriveVideoUrl: true,
        title: true
      }
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (!video.googleDriveFileId && !video.googleDriveVideoUrl) {
      return NextResponse.json({ 
        error: "Video is not stored in Google Drive" 
      }, { status: 400 });
    }

    // Try multiple Google Drive URL formats for better streaming compatibility
    const fileId = video.googleDriveFileId;
    const urls = [
      // Primary: Direct download URL with confirmation bypass (best for streaming)
      `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
      // Fallback 1: Alternative direct download format
      `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
      // Fallback 2: Legacy direct download format
      `https://drive.google.com/uc?id=${fileId}&export=download`,
      // Fallback 3: Saved URL from database (might be webContentLink)
      video.googleDriveVideoUrl,
      // Fallback 4: Preview URL (may work for smaller files)
      `https://drive.google.com/file/d/${fileId}/preview`
    ].filter(Boolean); // Remove null/undefined URLs

    console.log(`[Google Drive Proxy] Video ID: ${id}, Google Drive File ID: ${fileId}`);
    console.log(`[Google Drive Proxy] Trying ${urls.length} URL formats...`);

    let lastError: any = null;
    
    // Try each URL format until one works
    for (let i = 0; i < urls.length; i++) {
      const googleDriveUrl = urls[i];
      if (!googleDriveUrl) continue; // Skip null/undefined URLs
      
      console.log(`[Google Drive Proxy] Attempt ${i + 1}: ${googleDriveUrl}`);

      try {
        // Get range header for partial content requests (important for video)
        const range = request.headers.get('range');
        
        const fetchHeaders: HeadersInit = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'video/mp4,video/*,*/*;q=0.8',
          'Accept-Encoding': 'identity', // Important: don't compress video
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        };

        // Include range header if provided (for seeking support)
        if (range) {
          fetchHeaders['Range'] = range;
          console.log(`[Google Drive Proxy] Range request: ${range}`);
        }

        // Fetch the video from Google Drive
        const response = await fetch(googleDriveUrl, {
          headers: fetchHeaders
        });

        // Check if response is successful
        if (!response.ok) {
          console.log(`[Google Drive Proxy] URL ${i + 1} failed: ${response.status} ${response.statusText}`);
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
          continue; // Try next URL
        }

        // Check if we got HTML instead of video (Google Drive warning page)
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          console.log(`[Google Drive Proxy] URL ${i + 1} returned HTML (likely warning page), trying next...`);
          lastError = new Error('Received HTML instead of video content');
          continue; // Try next URL
        }

        console.log(`[Google Drive Proxy] Success with URL ${i + 1}`);
        console.log(`[Google Drive Proxy] Content-Type: ${contentType}`);
        console.log(`[Google Drive Proxy] Content-Length: ${response.headers.get('content-length')}`);

        // Prepare response headers for video streaming
        const responseHeaders = new Headers();
        
        // Essential video streaming headers
        responseHeaders.set('Content-Type', contentType.includes('video') ? contentType : 'video/mp4');
        responseHeaders.set('Accept-Ranges', 'bytes');
        responseHeaders.set('Cache-Control', 'public, max-age=3600');
        responseHeaders.set('Access-Control-Allow-Origin', '*');
        responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        responseHeaders.set('Access-Control-Allow-Headers', 'Range');

        // Copy content length and range headers if present
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          responseHeaders.set('Content-Length', contentLength);
        }

        const contentRange = response.headers.get('content-range');
        if (contentRange) {
          responseHeaders.set('Content-Range', contentRange);
        }

        // Return appropriate status code
        const status = response.status === 206 ? 206 : 200; // Preserve partial content status

        return new NextResponse(response.body, {
          status: status,
          headers: responseHeaders
        });

      } catch (fetchError) {
        console.log(`[Google Drive Proxy] URL ${i + 1} error:`, fetchError);
        lastError = fetchError;
        continue; // Try next URL
      }
    }

    // If all URLs failed, return error
    console.error(`[Google Drive Proxy] All URL formats failed for video ${id}`);
    console.error(`[Google Drive Proxy] Last error:`, lastError);
    
    return NextResponse.json({
      error: "Failed to stream video from Google Drive",
      details: lastError instanceof Error ? lastError.message : "All streaming URLs failed",
      troubleshooting: "The video might be private, deleted, or Google Drive is temporarily unavailable",
      fileId: fileId,
      urlsTried: urls.length
    }, { status: 502 });

  } catch (error) {
    console.error("[Google Drive Proxy] General error:", error);
    return NextResponse.json({
      error: "Failed to proxy Google Drive video",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Range, Content-Type',
    },
  });
} 