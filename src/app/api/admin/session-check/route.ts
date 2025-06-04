import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    console.log("[Session Check] Starting session verification...");
    
    // Get session
    const session = await getServerSession(authOptions);
    console.log("[Session Check] Session:", session ? "Found" : "Not found");
    
    if (!session?.user) {
      return NextResponse.json({
        status: "no_session",
        message: "No active session found"
      });
    }

    // Check if admin exists in database
    const adminExists = await prisma.admin.findUnique({
      where: { id: session.user.id },
      select: { 
        id: true, 
        username: true,
        createdAt: true
      }
    });

    console.log("[Session Check] Admin in DB:", adminExists ? "Found" : "Not found");

    return NextResponse.json({
      status: "ok",
      session: {
        id: session.user.id,
        username: session.user.username,
        role: session.user.role
      },
      admin: adminExists ? {
        id: adminExists.id,
        username: adminExists.username,
        createdAt: adminExists.createdAt
      } : null,
      message: adminExists ? "Session and admin are valid" : "Session exists but admin not found in database"
    });

  } catch (error) {
    console.error("[Session Check] Error:", error);
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
      details: String(error)
    }, { status: 500 });
  }
} 