const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

async function cleanupDuplicateVideos() {
  console.log('🔍 Starting duplicate video cleanup...');
  
  try {
    // Find all videos grouped by title and adminId
    const videos = await prisma.video.findMany({
      orderBy: {
        createdAt: 'asc' // Keep the oldest video
      }
    });

    console.log(`📊 Total videos found: ${videos.length}`);

    // Group videos by title and adminId
    const videoGroups = {};
    
    videos.forEach(video => {
      const key = `${video.title.trim()}-${video.adminId}`;
      if (!videoGroups[key]) {
        videoGroups[key] = [];
      }
      videoGroups[key].push(video);
    });

    // Find duplicates
    const duplicateGroups = Object.entries(videoGroups).filter(([key, group]) => group.length > 1);
    
    console.log(`🔄 Found ${duplicateGroups.length} groups with duplicates`);

    let totalDeleted = 0;

    for (const [key, group] of duplicateGroups) {
      const [titleAdmin, adminId] = key.split('-');
      console.log(`\n📝 Processing duplicates for: "${group[0].title}" (Admin: ${adminId})`);
      console.log(`   Found ${group.length} duplicates`);
      
      // Keep the first (oldest) video, delete the rest
      const toKeep = group[0];
      const toDelete = group.slice(1);
      
      console.log(`   ✅ Keeping: ${toKeep.id} (Created: ${toKeep.createdAt})`);
      
      for (const video of toDelete) {
        try {
          console.log(`   🗑️  Deleting: ${video.id} (Created: ${video.createdAt})`);
          
          // Delete the video from database (this will cascade delete likes)
          await prisma.video.delete({
            where: { id: video.id }
          });
          
          totalDeleted++;
          console.log(`   ✅ Deleted video: ${video.id}`);
          
        } catch (deleteError) {
          console.error(`   ❌ Failed to delete video ${video.id}:`, deleteError.message);
        }
      }
    }

    console.log(`\n✅ Cleanup completed!`);
    console.log(`📊 Total videos deleted: ${totalDeleted}`);
    console.log(`📊 Remaining videos: ${videos.length - totalDeleted}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupDuplicateVideos(); 