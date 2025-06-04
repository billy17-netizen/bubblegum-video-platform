import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if auth code exists
    const authCode = await prisma.authCode.findUnique({
      where: { id },
    });

    if (!authCode) {
      return NextResponse.json({ error: "Auth code not found" }, { status: 404 });
    }

    // Delete the auth code
    await prisma.authCode.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Auth code deleted successfully" });
  } catch (error) {
    console.error("Error deleting auth code:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { expiresAt } = body;

    // Check if auth code exists
    const authCode = await prisma.authCode.findUnique({
      where: { id },
    });

    if (!authCode) {
      return NextResponse.json({ error: "Auth code not found" }, { status: 404 });
    }

    // Update the auth code (removed restriction for used auth codes)
    const updatedAuthCode = await prisma.authCode.update({
      where: { id },
      data: {
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    // Add computed fields and format response
    const authCodeWithStatus = {
      ...updatedAuthCode,
      isExpired: updatedAuthCode.expiresAt ? new Date(updatedAuthCode.expiresAt) < new Date() : false,
      usedBy: updatedAuthCode.user,
    };

    return NextResponse.json({ 
      message: "Auth code updated successfully",
      authCode: authCodeWithStatus
    });
  } catch (error) {
    console.error("Error updating auth code:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 