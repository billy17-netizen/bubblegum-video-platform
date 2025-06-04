import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    console.log("Profile update request received");
    
    // Get the user's session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      console.log("Unauthorized: No session or user");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("Session user:", {
      id: session.user.id,
      username: session.user.username
    });

    try {
      // Parse the request body
      const body = await request.json();
      const { username, bio } = body;
      
      console.log("Request data received:", { 
        username, 
        bioLength: bio ? bio.length : 0
      });

      // Basic validation
      if (!username || username.trim() === "") {
        return NextResponse.json(
          { error: "Username is required" },
          { status: 400 }
        );
      }

      // Check if user exists in the database
      let user;
      try {
        user = await prisma.user.findUnique({
          where: {
            id: session.user.id as string,
          },
        });
        
        console.log("User found in database:", !!user);
        
        if (!user) {
          console.log("User not found in database, will try username lookup");
          // Try finding by username instead
          user = await prisma.user.findUnique({
            where: {
              username: session.user.username as string,
            },
          });
          
          if (!user) {
            return NextResponse.json(
              { error: "User not found in database" },
              { status: 404 }
            );
          }
        }
      } catch (dbError) {
        console.error("Database error looking up user:", dbError);
        return NextResponse.json(
          { error: "Database error when finding user" },
          { status: 500 }
        );
      }
      
      // Check if the username is taken by another user
      if (username !== user.username) {
        try {
          const existingUser = await prisma.user.findUnique({
            where: {
              username,
            },
          });
          
          if (existingUser && existingUser.id !== user.id) {
            return NextResponse.json(
              { error: "Username already taken" },
              { status: 400 }
            );
          }
        } catch (uniqueError) {
          console.error("Error checking username uniqueness:", uniqueError);
        }
      }
      
      // Get current user data
      const currentUser = await prisma.user.findUnique({
        where: {
          id: user.id
        },
        select: {
          image: true
        }
      });

      console.log("Current user image:", currentUser?.image);
      
      // Update user in database
      let updatedUser;
      try {
        console.log("Updating user in database:", user.id);
        updatedUser = await prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            username,
            bio: bio || null,
            // Preserve the existing image field - don't update it here
          },
        });
        
        console.log("User updated successfully in database");
      } catch (updateError) {
        console.error("Error updating user in database:", updateError);
        return NextResponse.json(
          { error: "Failed to update user in database" },
          { status: 500 }
        );
      }

      // Return success with updated user data
      return NextResponse.json({
        success: true,
        message: "Profile updated successfully",
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          bio: updatedUser.bio,
          image: updatedUser.image,
        },
      });
    } catch (bodyError) {
      console.error("Error parsing request body:", bodyError);
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Unexpected error in profile update:", error);
    return NextResponse.json(
      { error: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
} 