import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  try {
    console.log("[DEBUG] File system check starting...");
    
    // Check current working directory
    const cwd = process.cwd();
    console.log("[DEBUG] Current working directory:", cwd);
    
    // Check if public directory exists
    const publicDir = path.join(cwd, "public");
    const publicExists = fs.existsSync(publicDir);
    console.log("[DEBUG] Public directory exists:", publicExists);
    
    // Check if videos directory exists
    const videosDir = path.join(publicDir, "videos");
    const videosExists = fs.existsSync(videosDir);
    console.log("[DEBUG] Videos directory exists:", videosExists);
    
    let videoFiles: string[] = [];
    let videoFileDetails: Array<{name: string, size: number, path: string}> = [];
    
    if (videosExists) {
      videoFiles = fs.readdirSync(videosDir);
      console.log("[DEBUG] Found video files:", videoFiles.length);
      
      // Get details of first few video files
      videoFileDetails = videoFiles.slice(0, 5).map(file => {
        const filePath = path.join(videosDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          path: filePath
        };
      });
    }
    
    // Check environment
    const nodeEnv = process.env.NODE_ENV;
    const platform = process.platform;
    
    // Return diagnostic info
    return NextResponse.json({
      success: true,
      diagnostics: {
        currentWorkingDirectory: cwd,
        nodeEnvironment: nodeEnv,
        platform: platform,
        directories: {
          public: {
            path: publicDir,
            exists: publicExists
          },
          videos: {
            path: videosDir,
            exists: videosExists
          }
        },
        videoFiles: {
          count: videoFiles.length,
          files: videoFileDetails,
          allFiles: videoFiles.slice(0, 10) // Show first 10 files
        }
      }
    });
    
  } catch (error) {
    console.error("[DEBUG] File system check error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      diagnostics: {
        currentWorkingDirectory: process.cwd(),
        nodeEnvironment: process.env.NODE_ENV,
        platform: process.platform
      }
    });
  }
} 