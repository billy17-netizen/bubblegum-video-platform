import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    // Check if admin already exists
    const adminExists = await prisma.admin.findFirst();
    
    if (adminExists) {
      return NextResponse.json({ 
        message: "Admin user already exists",
        username: adminExists.username
      });
    }

    // Create admin user
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || "admin123";
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    const admin = await prisma.admin.create({
      data: {
        username: "admin",
        password: hashedPassword,
      },
    });
    
    return NextResponse.json({
      success: true,
      message: "Admin user created successfully",
      username: admin.username
    });
  } catch (error) {
    console.error("Error setting up admin:", error);
    return NextResponse.json(
      { error: "Failed to set up admin user" },
      { status: 500 }
    );
  }
} 