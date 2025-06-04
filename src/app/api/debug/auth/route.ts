import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions);
    
    // Basic session info
    const sessionInfo = {
      hasSession: !!session,
      user: session?.user ? {
        email: session.user.email,
        username: session.user.username,
        name: session.user.name,
        image: session.user.image,
        role: session.user.role
      } : null
    };

    // Check admin status if session exists
    let adminInfo = null;
    const userIdentifier = session?.user?.email || session?.user?.username;
    
    if (userIdentifier) {
      try {
        const admin = await prisma.admin.findUnique({
          where: { username: userIdentifier }
        });
        
        adminInfo = {
          userIdentifier: userIdentifier,
          isAdmin: !!admin,
          adminId: admin?.id || null,
          adminUsername: admin?.username || null,
          searchedBy: session?.user?.email ? 'email' : 'username'
        };
      } catch (error) {
        adminInfo = {
          userIdentifier: userIdentifier,
          isAdmin: false,
          error: 'Database connection failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Get all admins (for debugging)
    let allAdmins: Array<{ id: string; username: string; createdAt: Date }> = [];
    try {
      allAdmins = await prisma.admin.findMany({
        select: {
          id: true,
          username: true,
          createdAt: true
        }
      });
    } catch (error) {
      console.error('Failed to fetch admins:', error);
    }

    return NextResponse.json({
      success: true,
      session: sessionInfo,
      admin: adminInfo,
      debug: {
        allAdmins: allAdmins,
        totalAdmins: allAdmins.length,
        authOptionsExists: !!authOptions,
        prismaConnected: true
      }
    });

  } catch (error) {
    console.error('[Debug Auth] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Authentication debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 