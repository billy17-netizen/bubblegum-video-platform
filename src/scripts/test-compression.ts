#!/usr/bin/env ts-node

/**
 * Test script untuk menguji fungsi kompresi video
 * Usage: npx ts-node src/scripts/test-compression.ts <path-to-video-file>
 */

import { 
  shouldCompressVideo, 
  compressVideo, 
  getVideoMetadata,
  VideoCompressionOptions 
} from '../lib/videoService.server';
import fs from 'fs';
import path from 'path';

async function testCompression() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npx ts-node src/scripts/test-compression.ts <path-to-video-file>');
    process.exit(1);
  }
  
  const inputPath = args[0];
  
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: File tidak ditemukan: ${inputPath}`);
    process.exit(1);
  }
  
  console.log('🎬 Video Compression Test');
  console.log('========================');
  console.log(`Input file: ${inputPath}`);
  console.log('');
  
  try {
    // 1. Get metadata
    console.log('📊 Menganalisis metadata...');
    const metadata = await getVideoMetadata(inputPath);
    
    if (metadata.error) {
      console.error(`Error getting metadata: ${metadata.error}`);
      return;
    }
    
    console.log('Metadata:');
    console.log(`- Duration: ${metadata.duration?.toFixed(2)}s`);
    console.log(`- Resolution: ${metadata.width}x${metadata.height}`);
    console.log(`- File Size: ${((metadata.fileSize || 0) / 1024 / 1024).toFixed(2)}MB`);
    console.log(`- Bitrate: ${((metadata.bitrate || 0) / 1000).toFixed(0)}kbps`);
    console.log('');
    
    // 2. Check if compression needed
    console.log('🔍 Mengecek apakah perlu kompresi...');
    const compressionCheck = await shouldCompressVideo(inputPath, {
      maxSizeMB: 50,
      maxBitrate: 3000000
    });
    
    console.log(`Result: ${compressionCheck.shouldCompress ? '✅ Perlu kompresi' : '❌ Tidak perlu kompresi'}`);
    console.log(`Reason: ${compressionCheck.reason}`);
    console.log('');
    
    if (!compressionCheck.shouldCompress) {
      console.log('Video sudah dalam ukuran yang optimal. Test selesai.');
      return;
    }
    
    // 3. Compress video
    const outputPath = inputPath.replace(/\.[^/.]+$/, '.compressed.mp4');
    
    console.log('🗜️  Memulai kompresi...');
    console.log(`Output akan disimpan di: ${outputPath}`);
    console.log('');
    
    const compressionOptions: VideoCompressionOptions = {
      quality: 'medium',
      maxFileSizeMB: 25
    };
    
    const result = await compressVideo(inputPath, outputPath, compressionOptions);
    
    if (result.success) {
      console.log('✅ Kompresi berhasil!');
      console.log(`Original size: ${((result.originalSize || 0) / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Compressed size: ${((result.compressedSize || 0) / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Compression ratio: ${(result.compressionRatio || 0).toFixed(1)}%`);
      console.log(`Saved: ${(((result.originalSize || 0) - (result.compressedSize || 0)) / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Output file: ${outputPath}`);
    } else {
      console.error('❌ Kompresi gagal!');
      console.error(`Error: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  testCompression();
}

export { testCompression }; 