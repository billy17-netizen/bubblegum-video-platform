const { PrismaClient } = require('../src/generated/prisma');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function resetDatabase() {
  try {
    console.log('🚀 Starting database reset...');
    
    // 1. Get admin user data before deletion (to preserve it)
    const existingAdmin = await prisma.admin.findFirst();
    console.log('📋 Current admin:', existingAdmin ? existingAdmin.username : 'No admin found');
    
    // 2. Delete all data in the correct order (due to foreign key constraints)
    console.log('🗑️  Deleting all data...');
    
    // Delete video likes first (depends on both users and videos)
    const deletedLikes = await prisma.videoLike.deleteMany();
    console.log(`   - Deleted ${deletedLikes.count} video likes`);
    
    // Delete users (this will also handle authCode relationships)
    const deletedUsers = await prisma.user.deleteMany();
    console.log(`   - Deleted ${deletedUsers.count} users`);
    
    // Delete videos
    const deletedVideos = await prisma.video.deleteMany();
    console.log(`   - Deleted ${deletedVideos.count} videos`);
    
    // Delete auth codes
    const deletedAuthCodes = await prisma.authCode.deleteMany();
    console.log(`   - Deleted ${deletedAuthCodes.count} auth codes`);
    
    // Delete all admins
    const deletedAdmins = await prisma.admin.deleteMany();
    console.log(`   - Deleted ${deletedAdmins.count} admins`);
    
    // 3. Recreate admin user
    console.log('👤 Recreating admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const newAdmin = await prisma.admin.create({
      data: {
        username: existingAdmin ? existingAdmin.username : 'admin',
        password: hashedPassword,
      },
    });
    
    console.log(`✅ Admin user recreated: ${newAdmin.username}`);
    console.log('🎉 Database reset completed successfully!');
    console.log('');
    console.log('📊 Final state:');
    console.log(`   - Admins: 1 (${newAdmin.username})`);
    console.log('   - Users: 0');
    console.log('   - Videos: 0');
    console.log('   - Auth Codes: 0');
    console.log('   - Video Likes: 0');
    console.log('');
    console.log('🔑 Admin credentials:');
    console.log(`   - Username: ${newAdmin.username}`);
    console.log('   - Password: admin123');
    
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase(); 