import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    console.log("=== Starting profile image upload process ===");
    
    // Get the user's session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      console.log("Unauthorized: No session or user");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log(`User from session: ID=${session.user.id}, username=${session.user.username}`);

    // Process the form data
    const formData = await req.formData();
    const imageFile = formData.get("image") as File;

    if (!imageFile) {
      console.log("No image file provided in request");
      return NextResponse.json(
        { error: "Image file is required" },
        { status: 400 }
      );
    }

    console.log(`Received image: ${imageFile.name}, size: ${imageFile.size} bytes, type: ${imageFile.type}`);

    // Check file size (limit to 5MB)
    if (imageFile.size > 5 * 1024 * 1024) {
      console.log(`Image too large: ${imageFile.size} bytes`);
      return NextResponse.json(
        { error: "Image file is too large. Maximum size is 5MB" },
        { status: 400 }
      );
    }

    // Create unique filename
    const imageId = randomUUID();
    const imageExt = imageFile.name.split(".").pop();
    const imageFilename = `${imageId}.${imageExt}`;
    
    console.log(`Generated unique filename: ${imageFilename}`);
    
    // Ensure directory exists
    const profileImagesDir = path.join(process.cwd(), "public", "profile-images");
    
    console.log(`Profile images directory: ${profileImagesDir}`);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(profileImagesDir)) {
      console.log(`Creating profile-images directory: ${profileImagesDir}`);
      await mkdir(profileImagesDir, { recursive: true });
    }
    
    const imagePath = path.join(profileImagesDir, imageFilename);
    console.log(`Full path for saving image: ${imagePath}`);

    // Save the image file
    try {
      const imageArrayBuffer = await imageFile.arrayBuffer();
      const imageBuffer = Buffer.from(imageArrayBuffer);
      await writeFile(imagePath, imageBuffer);
      console.log(`Image file written successfully to ${imagePath}`);
    } catch (writeError) {
      console.error("Error writing file:", writeError);
      return NextResponse.json(
        { error: `Failed to write image file: ${writeError instanceof Error ? writeError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }
    
    // Verify the file was saved successfully
    if (!fs.existsSync(imagePath)) {
      console.error(`Failed to save image file to ${imagePath}`);
      return NextResponse.json(
        { error: "Failed to save image file" },
        { status: 500 }
      );
    }

    // Get the user
    let user;
    try {
      user = await prisma.user.findUnique({
        where: {
          id: session.user.id as string,
        },
      });
      
      console.log(`User found in database:`, user ? `ID=${user.id}, username=${user.username}` : "Not found");
    } catch (dbError) {
      console.error("Error finding user in database:", dbError);
      return NextResponse.json(
        { error: `Database error finding user: ${dbError instanceof Error ? dbError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }
    
    if (!user) {
      console.log("User not found in database, attempting to find by username");
      try {
        user = await prisma.user.findUnique({
          where: {
            username: session.user.username as string,
          },
        });
        console.log(`User lookup by username:`, user ? `ID=${user.id}, username=${user.username}` : "Not found");
      } catch (dbError2) {
        console.error("Error finding user by username:", dbError2);
      }
      
      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }
    }

    // Update user with new image path
    const imagePath4DB = `/profile-images/${imageFilename}`;
    let updatedUser;
    
    try {
      console.log(`Updating user ${user.id} with image path: ${imagePath4DB}`);
      updatedUser = await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          image: imagePath4DB,
        },
      });
      console.log(`User updated successfully with new image path`);
    } catch (updateError) {
      console.error("Error updating user with image path:", updateError);
      return NextResponse.json(
        { error: `Failed to update user in database: ${updateError instanceof Error ? updateError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Profile image uploaded successfully",
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        image: updatedUser.image,
      },
    });
  } catch (error) {
    console.error("Error uploading profile image:", error);
    return NextResponse.json(
      { error: `Failed to upload profile image: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
} 