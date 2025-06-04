import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCodes = await prisma.authCode.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Add computed fields for status and map user to usedBy
    const authCodesWithStatus = authCodes.map((code: any) => ({
      id: code.id,
      code: code.code,
      expiresAt: code.expiresAt,
      createdAt: code.createdAt,
      isExpired: code.expiresAt ? new Date(code.expiresAt) < new Date() : false,
      isUsed: code.isUsed,
      usedBy: code.user, // Map user to usedBy for frontend compatibility
    }));

    return NextResponse.json({ authCodes: authCodesWithStatus });
  } catch (error) {
    console.error("Error fetching auth codes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 