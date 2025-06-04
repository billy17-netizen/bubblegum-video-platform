import { NextRequest, NextResponse } from 'next/server';
import { thumbnailCacheManager } from '@/lib/thumbnailCache';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { action, videoId, thumbnailPath } = await request.json();

    switch (action) {
      case 'clear-all':
        thumbnailCacheManager.clearCache();
        return NextResponse.json({ 
          success: true, 
          message: 'All thumbnail caches cleared' 
        });

      case 'refresh-video':
        if (!videoId) {
          return NextResponse.json({ 
            success: false, 
            error: 'Video ID required' 
          }, { status: 400 });
        }
        
        thumbnailCacheManager.refreshThumbnail(videoId);
        return NextResponse.json({ 
          success: true, 
          message: `Thumbnail cache refreshed for video: ${videoId}` 
        });

      case 'verify-file':
        if (!thumbnailPath) {
          return NextResponse.json({ 
            success: false, 
            error: 'Thumbnail path required' 
          }, { status: 400 });
        }

        const fullPath = path.join(process.cwd(), 'public', thumbnailPath);
        const exists = fs.existsSync(fullPath);
        
        return NextResponse.json({ 
          success: true, 
          exists,
          path: fullPath,
          message: exists ? 'Thumbnail file exists' : 'Thumbnail file not found'
        });

      case 'scan-thumbnails':
        // Scan thumbnail directory and return file list
        const thumbnailDir = path.join(process.cwd(), 'public', 'thumbnails');
        try {
          const files = fs.readdirSync(thumbnailDir)
            .filter(file => file.endsWith('.jpg'))
            .map(file => ({
              name: file,
              path: `/thumbnails/${file}`,
              size: fs.statSync(path.join(thumbnailDir, file)).size,
              modified: fs.statSync(path.join(thumbnailDir, file)).mtime
            }));

          return NextResponse.json({ 
            success: true, 
            files,
            count: files.length,
            message: `Found ${files.length} thumbnail files`
          });
        } catch (error) {
          console.error('Error scanning thumbnails:', error);
          return NextResponse.json({ 
            success: false, 
            error: 'Failed to scan thumbnail directory',
            details: error instanceof Error ? error.message : String(error)
          }, { status: 500 });
        }

      default:
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid action' 
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Thumbnail cache API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}