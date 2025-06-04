import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    // Verify admin session
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check environment variables (without exposing actual values)
    const envCheck = {
      database: {
        DATABASE_URL: !!process.env.DATABASE_URL,
        hasValue: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + "..." : "Not set"
      },
      nextAuth: {
        NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
        NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
        nextAuthUrl: process.env.NEXTAUTH_URL || "Not set"
      },
      cloudinary: {
        CLOUDINARY_CLOUD_NAME: !!process.env.CLOUDINARY_CLOUD_NAME,
        CLOUDINARY_API_KEY: !!process.env.CLOUDINARY_API_KEY,
        CLOUDINARY_API_SECRET: !!process.env.CLOUDINARY_API_SECRET,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME || "Not set"
      },
      app: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT
      }
    };

    // Additional system checks
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      cwd: process.cwd(),
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };

    return NextResponse.json({
      status: "ok",
      environment: envCheck,
      system: systemInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error in debug endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 