import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    // Verify admin session
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      console.error("No session found");
      return NextResponse.json({ error: "Unauthorized: No session" }, { status: 401 });
    }
    
    if (session.user.role !== "ADMIN") {
      console.error("Not admin role:", session.user.role);
      return NextResponse.json({ error: "Unauthorized: Not admin" }, { status: 401 });
    }

    // Generate a random 6-character code
    const code = randomBytes(3).toString("hex");

    // Calculate expiry time (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Create auth code in database
    const authCode = await prisma.authCode.create({
      data: {
        code,
        expiresAt,
        adminId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      code: authCode.code,
      expiresAt: authCode.expiresAt,
    });
  } catch (error) {
    console.error("Error generating auth code:", error);
    return NextResponse.json(
      { error: "Failed to generate auth code" },
      { status: 500 }
    );
  }
} 