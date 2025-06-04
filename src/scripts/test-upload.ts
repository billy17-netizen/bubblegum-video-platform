import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Running upload test script ===');
  
  // 1. Check if the profile-images directory exists in public
  const profileImagesDir = path.join(process.cwd(), 'public', 'profile-images');
  
  if (!fs.existsSync(profileImagesDir)) {
    console.log(`Creating profile-images directory: ${profileImagesDir}`);
    fs.mkdirSync(profileImagesDir, { recursive: true });
  } else {
    console.log(`Profile images directory exists: ${profileImagesDir}`);
  }
  
  // 2. Create a test image file
  const testImagePath = path.join(profileImagesDir, `test-${randomUUID()}.txt`);
  fs.writeFileSync(testImagePath, 'This is a test file');
  console.log(`Created test file at: ${testImagePath}`);
  
  // 3. Test database operations
  try {
    // Get all users
    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users in database`);
    
    if (users.length > 0) {
      const testUser = users[0];
      console.log('Test user:', {
        id: testUser.id,
        username: testUser.username,
        image: testUser.image
      });
      
      // Try updating user's image
      const imagePath = `/profile-images/test-${randomUUID()}.jpg`;
      console.log(`Attempting to update user ${testUser.id} with image path: ${imagePath}`);
      
      const updatedUser = await prisma.user.update({
        where: { id: testUser.id },
        data: { image: imagePath }
      });
      
      console.log('Updated user:', {
        id: updatedUser.id,
        username: updatedUser.username,
        image: updatedUser.image
      });
      
      // Verify update worked
      const verifiedUser = await prisma.user.findUnique({
        where: { id: testUser.id }
      });
      
      console.log('Verified user after update:', {
        id: verifiedUser?.id,
        username: verifiedUser?.username,
        image: verifiedUser?.image
      });
      
      // Reset image path
      await prisma.user.update({
        where: { id: testUser.id },
        data: { image: testUser.image }
      });
      
      console.log('Reset user image to original value');
    }
  } catch (error) {
    console.error('Database operation error:', error);
  }
  
  // Clean up test file
  try {
    fs.unlinkSync(testImagePath);
    console.log(`Removed test file: ${testImagePath}`);
  } catch (err) {
    console.error('Error cleaning up test file:', err);
  }
}

main()
  .then(() => console.log('Test completed successfully'))
  .catch((e) => console.error('Test failed:', e))
  .finally(async () => {
    await prisma.$disconnect();
  }); 