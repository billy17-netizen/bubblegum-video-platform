import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Get the user's session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch user data from database
    let user = await prisma.user.findUnique({
      where: {
        id: session.user.id as string,
      },
    });

    // Try finding by username if not found by ID
    if (!user && session.user.username) {
      user = await prisma.user.findUnique({
        where: {
          username: session.user.username as string,
        },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Add additional fields for compatibility
    const userData = {
      ...user,
      name: user.username || session.user.name || 'User',
      email: session.user.email || "",
    };

    return NextResponse.json({ user: userData });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 }
    );
  }
} 