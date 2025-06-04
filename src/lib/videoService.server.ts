// Production-safe video service stub
// This file provides stubs for FFmpeg functionality when FFmpeg is not available

import fs from 'fs';
import { promisify } from 'util';

const statAsync = promisify(fs.stat);

export interface VideoCompressionOptions {
  quality?: 'low' | 'medium' | 'high';
  maxWidth?: number;
  maxHeight?: number;
  videoBitrate?: string;
  audioBitrate?: string;
  outputFormat?: 'mp4' | 'webm';
  maxFileSizeMB?: number;
}

/**
 * Stub function - FFmpeg not available in production
 */
export function compressVideo(
  inputPath: string, 
  outputPath: string, 
  options: VideoCompressionOptions = {}
): Promise<{ success: boolean; outputPath?: string; originalSize?: number; compressedSize?: number; compressionRatio?: number; error?: string }> {
  return Promise.resolve({
    success: false,
    error: 'FFmpeg compression not available in production environment'
  });
}

/**
 * Stub function - FFmpeg not available in production
 */
export async function compressVideoInPlace(
  filePath: string,
  options: VideoCompressionOptions = {}
): Promise<{ success: boolean; originalSize?: number; compressedSize?: number; compressionRatio?: number; error?: string }> {
  console.log('[VideoService] FFmpeg not available, skipping compression');
  
  try {
    const stats = await statAsync(filePath);
    return {
      success: true,
      originalSize: stats.size,
      compressedSize: stats.size,
      compressionRatio: 0
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Stub function - FFmpeg not available in production
 */
export function getVideoMetadata(filePath: string): Promise<{ duration?: number; width?: number; height?: number; fileSize?: number; bitrate?: number; error?: string }> {
  console.log('[VideoService] FFmpeg not available, returning basic metadata');
  
  return statAsync(filePath).then(stats => ({
    fileSize: stats.size
  })).catch(error => ({
    error: error instanceof Error ? error.message : 'Unknown error'
  }));
}

/**
 * Determine if video needs compression based on file size only
 */
export async function shouldCompressVideo(
  filePath: string,
  options: { maxSizeMB?: number; maxBitrate?: number } = {}
): Promise<{ shouldCompress: boolean; reason?: string; metadata?: any }> {
  try {
    const metadata = await getVideoMetadata(filePath);
    
    if (metadata.error) {
      return { shouldCompress: false, reason: 'Could not analyze video' };
    }
    
    const fileSizeMB = metadata.fileSize ? metadata.fileSize / 1024 / 1024 : 0;
    const maxSizeMB = options.maxSizeMB || 50;
    
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
    return { 
      shouldCompress: false, 
      reason: 'Error analyzing video' 
    };
  }
} 