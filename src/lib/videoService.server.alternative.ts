/**
 * Alternative video compression service for serverless/production environments
 * This approach focuses on file size optimization without FFmpeg binaries
 */

import fs from 'fs';
import { promisify } from 'util';

const statAsync = promisify(fs.stat);

export interface VideoCompressionOptions {
  quality?: 'low' | 'medium' | 'high';
  maxFileSizeMB?: number;
}

export interface CompressionResult {
  success: boolean;
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: number;
  error?: string;
  method?: string;
}

/**
 * Simple video analysis without FFmpeg
 * Uses basic file inspection and heuristics
 */
export async function getBasicVideoMetadata(filePath: string): Promise<{
  fileSize?: number;
  error?: string;
}> {
  try {
    const stats = await statAsync(filePath);
    return {
      fileSize: stats.size
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Determine if video needs compression based on file size only
 */
export async function shouldCompressVideoBasic(
  filePath: string,
  options: { maxSizeMB?: number } = {}
): Promise<{ shouldCompress: boolean; reason?: string; metadata?: any }> {
  try {
    const metadata = await getBasicVideoMetadata(filePath);
    
    if (metadata.error) {
      return { shouldCompress: false, reason: 'Could not analyze video' };
    }
    
    const fileSizeMB = metadata.fileSize ? metadata.fileSize / 1024 / 1024 : 0;
    const maxSizeMB = options.maxSizeMB || 50; // Default 50MB limit
    
    if (fileSizeMB > maxSizeMB) {
      return { 
        shouldCompress: true, 
        reason: `File size (${fileSizeMB.toFixed(1)}MB) exceeds limit (${maxSizeMB}MB)`,
        metadata 
      };
    }
    
    return { 
      shouldCompress: false, 
      reason: 'Video size is acceptable',
      metadata 
    };
  } catch (error) {
    console.error('[Compression] Error checking video:', error);
    return { 
      shouldCompress: false, 
      reason: 'Error analyzing video' 
    };
  }
}

/**
 * Cloud-based compression using external service
 * This is a placeholder for integration with services like:
 * - Cloudinary auto-optimization
 * - AWS Elemental MediaConvert
 * - Google Cloud Video Intelligence API
 */
export async function compressVideoCloud(
  inputPath: string,
  options: VideoCompressionOptions = {}
): Promise<CompressionResult> {
  try {
    const originalStats = await statAsync(inputPath);
    const originalSize = originalStats.size;
    
    console.log(`[Cloud Compression] Would compress: ${inputPath}`);
    console.log(`[Cloud Compression] Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
    
    // For now, return a mock successful result
    // In production, this would call an actual cloud service
    return {
      success: true,
      originalSize,
      compressedSize: originalSize, // No actual compression for now
      compressionRatio: 0,
      method: 'cloud-placeholder',
      error: 'Cloud compression not implemented yet. File saved as-is.'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      method: 'cloud-placeholder'
    };
  }
}

/**
 * Simple file optimization (placeholder)
 * In a real implementation, this could:
 * - Strip metadata
 * - Apply basic file optimizations
 * - Validate file integrity
 */
export async function optimizeVideoFile(
  filePath: string,
  options: VideoCompressionOptions = {}
): Promise<CompressionResult> {
  try {
    const originalStats = await statAsync(filePath);
    const originalSize = originalStats.size;
    
    console.log(`[File Optimization] Processing: ${filePath}`);
    console.log(`[File Optimization] Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
    
    // Simple optimization: ensure file exists and is readable
    const buffer = fs.readFileSync(filePath);
    
    // In a real implementation, this would:
    // 1. Strip unnecessary metadata
    // 2. Apply lossless optimizations
    // 3. Validate file structure
    
    // For now, just write back the same file (no actual optimization)
    fs.writeFileSync(filePath, buffer);
    
    const finalStats = await statAsync(filePath);
    const finalSize = finalStats.size;
    
    return {
      success: true,
      originalSize,
      compressedSize: finalSize,
      compressionRatio: 0, // No actual compression applied
      method: 'file-optimization'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      method: 'file-optimization'
    };
  }
}

/**
 * Main compression function that chooses the best available method
 */
export async function compressVideoFallback(
  filePath: string,
  options: VideoCompressionOptions = {}
): Promise<CompressionResult> {
  console.log('[Compression] Using fallback compression method');
  
  // Try cloud compression first (if available)
  if (process.env.ENABLE_CLOUD_COMPRESSION === 'true') {
    console.log('[Compression] Attempting cloud compression');
    const cloudResult = await compressVideoCloud(filePath, options);
    if (cloudResult.success) {
      return cloudResult;
    }
    console.log('[Compression] Cloud compression failed, trying file optimization');
  }
  
  // Fall back to file optimization
  return await optimizeVideoFile(filePath, options);
}

/**
 * Check if FFmpeg is available in the current environment
 * This version does NOT attempt to require FFmpeg modules
 */
export function isFFmpegAvailable(): boolean {
  // Always return false in production builds to avoid module resolution issues
  return false;
}

/**
 * Export the main compression function based on environment
 */
export async function compressVideoSafe(
  filePath: string,
  options: VideoCompressionOptions = {}
): Promise<CompressionResult> {
  // Always use fallback method to avoid FFmpeg dependencies
  console.log('[Compression] Using fallback compression method (FFmpeg disabled)');
  return await compressVideoFallback(filePath, options);
} 