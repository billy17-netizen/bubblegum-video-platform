import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { randomUUID } from 'crypto';

// Fix webpack import issues by using static requires where possible
let ffmpeg: any;
let ffmpegPath: string;
let ffprobePath: string;

async function initFFmpeg() {
  if (!ffmpeg) {
    const ffmpegModule = await import('fluent-ffmpeg');
    
    // Use a webpack-safe approach to get FFmpeg path
    try {
      // Method 0: Check for local FFmpeg installation first
      const localFFmpegPath = path.join(process.cwd(), 'ffmpeg-bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
      const localFFprobePath = path.join(process.cwd(), 'ffmpeg-bin', process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
      
      if (fs.existsSync(localFFmpegPath)) {
        ffmpegPath = localFFmpegPath;
        ffprobePath = localFFprobePath;
        console.log('[Thumbnail Generator] Using local FFmpeg installation:', ffmpegPath);
        console.log('[Thumbnail Generator] Using local FFprobe:', ffprobePath);
      } else {
        // Method 1: Try eval require (bypasses webpack static analysis)
        const ffmpegInstaller = eval('require')('@ffmpeg-installer/ffmpeg');
        ffmpegPath = ffmpegInstaller.path;
        console.log('[Thumbnail Generator] FFmpeg path from installer:', ffmpegPath);
        
        // FFprobe is usually in the same directory as FFmpeg
        const ffmpegDir = path.dirname(ffmpegPath);
        ffprobePath = path.join(ffmpegDir, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
        console.log('[Thumbnail Generator] FFprobe path:', ffprobePath);
      }
      
    } catch (error) {
      console.warn('[Thumbnail Generator] Installer method failed, using fallback:', error);
      
      // Method 2: Construct path manually based on platform
      const platform = process.platform;
      const arch = process.arch;
      
      let binaryName = 'ffmpeg';
      let probeName = 'ffprobe';
      if (platform === 'win32') {
        binaryName = 'ffmpeg.exe';
        probeName = 'ffprobe.exe';
      }
      
      // Construct expected paths
      const expectedPath = path.join(
        process.cwd(),
        'node_modules',
        '@ffmpeg-installer',
        `${platform}-${arch}`,
        binaryName
      );
      
      const expectedProbePath = path.join(
        process.cwd(),
        'node_modules',
        '@ffmpeg-installer',
        `${platform}-${arch}`,
        probeName
      );
      
      console.log('[Thumbnail Generator] Trying constructed path:', expectedPath);
      console.log('[Thumbnail Generator] Trying constructed ffprobe path:', expectedProbePath);
      
      if (fs.existsSync(expectedPath)) {
        ffmpegPath = expectedPath;
        ffprobePath = expectedProbePath;
        console.log('[Thumbnail Generator] Using constructed paths');
      } else {
        throw new Error(`FFmpeg binary not found at expected location: ${expectedPath}`);
      }
    }
    
    ffmpeg = ffmpegModule.default;
    
    // Set both FFmpeg and FFprobe paths
    ffmpeg.setFfmpegPath(ffmpegPath);
    if (fs.existsSync(ffprobePath)) {
      ffmpeg.setFfprobePath(ffprobePath);
      console.log('[Thumbnail Generator] FFprobe path set:', ffprobePath);
    } else {
      console.warn('[Thumbnail Generator] FFprobe not found, video validation may fail:', ffprobePath);
    }
    
    console.log('[Thumbnail Generator] FFmpeg initialized successfully:', ffmpegPath);
    
    // Final verification
    if (!fs.existsSync(ffmpegPath)) {
      throw new Error(`FFmpeg binary verification failed: ${ffmpegPath}`);
    }
  }
  return ffmpeg;
}

const unlinkAsync = promisify(fs.unlink);
const statAsync = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);

/**
 * Interface untuk opsi generate thumbnail
 */
export interface ThumbnailGenerationOptions {
  width?: number;
  height?: number;
  timeOffset?: string; // Format: '00:00:05' atau '5%' atau '10'
  quality?: number; // 1-100
  outputFormat?: 'jpg' | 'png' | 'webp';
}

/**
 * Interface untuk hasil generate thumbnail
 */
export interface ThumbnailGenerationResult {
  success: boolean;
  thumbnailPath?: string;
  thumbnailBuffer?: Buffer;
  width?: number;
  height?: number;
  fileSize?: number;
  error?: string;
  details?: string; // Additional error details
  isProductionLimitation?: boolean; // Indicates if error is due to production environment
}

/**
 * Ensure directory exists
 */
async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    if (!fs.existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true });
      console.log(`[Thumbnail Generator] Created directory: ${dirPath}`);
    }
  } catch (error) {
    console.error(`[Thumbnail Generator] Failed to create directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Get video dimensions and calculate proportional thumbnail size
 */
async function getVideoProportionalDimensions(
  videoPath: string,
  maxWidth: number = 1280,
  maxHeight: number = 720
): Promise<{ width: number; height: number }> {
  return new Promise(async (resolve) => {
    try {
      // Initialize FFmpeg first
      const ffmpegInstance = await initFFmpeg();

      // Check if ffprobe is available
      if (!ffprobePath || !fs.existsSync(ffprobePath)) {
        console.warn('[Thumbnail Generator] FFprobe not available, using default dimensions');
        resolve({ width: maxWidth, height: maxHeight });
        return;
      }

      ffmpegInstance.ffprobe(videoPath, (error: any, metadata: any) => {
        if (error) {
          console.error('[Thumbnail Generator] Video probe error:', error);
          console.warn('[Thumbnail Generator] Using default dimensions due to probe error');
          resolve({ width: maxWidth, height: maxHeight });
          return;
        }

        const videoStream = metadata.streams.find((stream: any) => stream.codec_type === 'video');
        
        if (!videoStream || !videoStream.width || !videoStream.height) {
          console.warn('[Thumbnail Generator] Could not get video dimensions, using defaults');
          resolve({ width: maxWidth, height: maxHeight });
          return;
        }

        const { width: videoWidth, height: videoHeight } = videoStream;
        
        // Calculate proportional dimensions maintaining aspect ratio
        const aspectRatio = videoWidth / videoHeight;
        
        let thumbnailWidth, thumbnailHeight;
        
        // Scale down proportionally to fit within max dimensions
        if (videoWidth > videoHeight) {
          // Landscape video
          thumbnailWidth = Math.min(videoWidth, maxWidth);
          thumbnailHeight = Math.round(thumbnailWidth / aspectRatio);
          
          if (thumbnailHeight > maxHeight) {
            thumbnailHeight = maxHeight;
            thumbnailWidth = Math.round(thumbnailHeight * aspectRatio);
          }
        } else {
          // Portrait or square video
          thumbnailHeight = Math.min(videoHeight, maxHeight);
          thumbnailWidth = Math.round(thumbnailHeight * aspectRatio);
          
          if (thumbnailWidth > maxWidth) {
            thumbnailWidth = maxWidth;
            thumbnailHeight = Math.round(thumbnailWidth / aspectRatio);
          }
        }

        console.log(`[Thumbnail Generator] Video dimensions analysis:`, {
          original: { width: videoWidth, height: videoHeight },
          aspectRatio: aspectRatio.toFixed(2),
          orientation: videoWidth > videoHeight ? 'landscape' : videoWidth < videoHeight ? 'portrait' : 'square',
          thumbnail: { width: thumbnailWidth, height: thumbnailHeight }
        });

        resolve({
          width: thumbnailWidth,
          height: thumbnailHeight
        });
      });
    } catch (error) {
      console.error('[Thumbnail Generator] Dimension calculation error:', error);
      resolve({ width: maxWidth, height: maxHeight });
    }
  });
}

/**
 * Calculate actual time in seconds from percentage or time string
 */
async function calculateTimeOffsetInSeconds(videoPath: string, timeOffset: string): Promise<number> {
  return new Promise(async (resolve) => {
    try {
      // If it's already in seconds format, return as is
      if (!timeOffset.includes('%')) {
        const seconds = parseFloat(timeOffset.replace(/[^0-9.]/g, ''));
        resolve(isNaN(seconds) ? 10 : seconds); // Default to 10 seconds
        return;
      }

      // Initialize FFmpeg first
      const ffmpegInstance = await initFFmpeg();

      // Check if ffprobe is available
      if (!ffprobePath || !fs.existsSync(ffprobePath)) {
        console.warn('[Thumbnail Generator] FFprobe not available, using default time offset');
        resolve(10); // Default to 10 seconds
        return;
      }

      ffmpegInstance.ffprobe(videoPath, (error: any, metadata: any) => {
        if (error) {
          console.error('[Thumbnail Generator] Video duration probe error:', error);
          resolve(10); // Default to 10 seconds
          return;
        }

        const duration = metadata.format.duration;
        if (!duration || duration <= 0) {
          console.warn('[Thumbnail Generator] Could not get video duration, using default');
          resolve(10);
          return;
        }

        // Extract percentage number
        const percentageMatch = timeOffset.match(/(\d+(?:\.\d+)?)%/);
        if (!percentageMatch) {
          console.warn('[Thumbnail Generator] Invalid percentage format, using default');
          resolve(10);
          return;
        }

        const percentage = parseFloat(percentageMatch[1]);
        const calculatedSeconds = (duration * percentage) / 100;
        
        // Ensure we don't seek past the video end
        const safeSeconds = Math.min(calculatedSeconds, duration - 1);
        
        console.log(`[Thumbnail Generator] Time offset calculation:`, {
          timeOffset,
          percentage: `${percentage}%`,
          duration: `${duration.toFixed(2)}s`,
          calculatedSeconds: `${calculatedSeconds.toFixed(2)}s`,
          safeSeconds: `${safeSeconds.toFixed(2)}s`
        });

        resolve(safeSeconds);
      });
    } catch (error) {
      console.error('[Thumbnail Generator] Time calculation error:', error);
      resolve(10); // Default to 10 seconds
    }
  });
}

/**
 * Generate thumbnail dari video file
 */
export function generateVideoThumbnail(
  videoPath: string,
  outputPath: string,
  options: ThumbnailGenerationOptions = {}
): Promise<ThumbnailGenerationResult> {
  return new Promise(async (resolve) => {
    try {
      const {
        timeOffset = '5%', // Ambil frame di 5% durasi video
        quality = 80,
        outputFormat = 'jpg'
      } = options;

      console.log(`[Thumbnail Generator] Generating thumbnail for ${videoPath}`);
      console.log(`[Thumbnail Generator] Output: ${outputPath}`);

      // Initialize FFmpeg with dynamic import
      const ffmpegInstance = await initFFmpeg();

      // Pastikan direktori output ada
      const outputDir = path.dirname(outputPath);
      await ensureDirectoryExists(outputDir);

      // Validate input video file exists
      if (!fs.existsSync(videoPath)) {
        resolve({
          success: false,
          error: `Video file not found: ${videoPath}`
        });
        return;
      }

      // Get proportional dimensions if not provided
      let { width, height } = options;
      if (!width || !height) {
        const proportionalDimensions = await getVideoProportionalDimensions(videoPath, 1280, 1280);
        width = proportionalDimensions.width;
        height = proportionalDimensions.height;
      }

      // Calculate actual time offset in seconds
      const timeOffsetSeconds = await calculateTimeOffsetInSeconds(videoPath, timeOffset);

      console.log(`[Thumbnail Generator] Using dimensions: ${width}x${height}`);
      console.log(`[Thumbnail Generator] Options:`, { width, height, timeOffset, timeOffsetSeconds: `${timeOffsetSeconds}s`, quality, outputFormat });

      // Use a simpler, more reliable approach compatible with older FFmpeg
      ffmpegInstance(videoPath)
        .seekInput(timeOffsetSeconds)
        .frames(1)
        .size(`${width}x${height}`)
        .autopad(false)
        .output(outputPath)
        .outputOptions([
          '-q:v', quality.toString(),
          '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease` // Removed force_divisible_by for older FFmpeg compatibility
        ])
        .on('start', (commandLine: string) => {
          console.log('[Thumbnail Generator] FFmpeg command:', commandLine);
        })
        .on('end', async () => {
          try {
            console.log(`[Thumbnail Generator] Thumbnail generated successfully: ${outputPath}`);
            
            // Verifikasi file dan dapatkan informasi
            if (!fs.existsSync(outputPath)) {
              resolve({
                success: false,
                error: 'Thumbnail file was not created'
              });
              return;
            }

            const stats = await statAsync(outputPath);
            const thumbnailBuffer = fs.readFileSync(outputPath);
            
            resolve({
              success: true,
              thumbnailPath: outputPath,
              thumbnailBuffer,
              width,
              height,
              fileSize: stats.size
            });
          } catch (error) {
            console.error('[Thumbnail Generator] Error reading generated thumbnail:', error);
            resolve({
              success: false,
              error: 'Failed to read generated thumbnail file'
            });
          }
        })
        .on('error', async (error: any) => {
          console.error('[Thumbnail Generator] FFmpeg error:', error);
          
          // Fallback: Try direct FFmpeg command if fluent-ffmpeg fails
          console.log('[Thumbnail Generator] Trying direct FFmpeg command as fallback...');
          
          try {
            const success = await generateThumbnailWithDirectCommand(videoPath, outputPath, {
              width,
              height,
              timeOffset: timeOffsetSeconds.toString(),
              quality
            });
            
            if (success) {
              console.log('[Thumbnail Generator] Direct FFmpeg command succeeded!');
              
              // Read the generated thumbnail
              const thumbnailBuffer = fs.readFileSync(outputPath);
              const stats = await statAsync(outputPath);
              
              resolve({
                success: true,
                thumbnailPath: outputPath,
                thumbnailBuffer,
                width,
                height,
                fileSize: stats.size
              });
              return;
            }
          } catch (directError) {
            console.error('[Thumbnail Generator] Direct command also failed:', directError);
          }
          
          resolve({
            success: false,
            error: error.message
          });
        })
        .run();

    } catch (error) {
      console.error('[Thumbnail Generator] Setup error:', error);
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

/**
 * Generate thumbnail dari video buffer (untuk di-memory processing)
 */
export function generateThumbnailFromBuffer(
  videoBuffer: Buffer,
  options: ThumbnailGenerationOptions = {}
): Promise<ThumbnailGenerationResult> {
  return new Promise(async (resolve) => {
    const tempVideoPath = path.join(process.cwd(), 'temp', `video_${randomUUID()}.mp4`);
    const tempThumbnailPath = path.join(process.cwd(), 'temp', `thumbnail_${randomUUID()}.jpg`);

    try {
      const {
        timeOffset = '10%', // Ambil frame di 10% durasi video
        quality = 85,
        outputFormat = 'jpg'
      } = options;

      console.log('[Thumbnail Generator] Generating thumbnail from buffer');
      console.log(`[Thumbnail Generator] Temp video: ${tempVideoPath}`);
      console.log(`[Thumbnail Generator] Temp thumbnail: ${tempThumbnailPath}`);

      // Initialize FFmpeg with dynamic import
      const ffmpegInstance = await initFFmpeg();

      // Pastikan direktori temp ada
      const tempDir = path.dirname(tempVideoPath);
      await ensureDirectoryExists(tempDir);

      // Write buffer to temporary file
      fs.writeFileSync(tempVideoPath, videoBuffer);
      console.log(`[Thumbnail Generator] Wrote ${videoBuffer.length} bytes to temp file`);

      // Validasi file video
      const isValidVideo = await isVideoValidForThumbnail(tempVideoPath);
      if (!isValidVideo) {
        await cleanup();
        resolve({
          success: false,
          error: 'Invalid video format or corrupted file'
        });
        return;
      }

      // Get proportional dimensions based on original video
      const proportionalDimensions = await getVideoProportionalDimensions(tempVideoPath, 1280, 1280);
      const { width, height } = proportionalDimensions;

      // Calculate actual time offset in seconds
      const timeOffsetSeconds = await calculateTimeOffsetInSeconds(tempVideoPath, timeOffset);

      console.log(`[Thumbnail Generator] Using proportional dimensions: ${width}x${height}`);
      console.log(`[Thumbnail Generator] Time offset: ${timeOffset} -> ${timeOffsetSeconds}s`);

      // Generate thumbnail dengan FFmpeg
      ffmpegInstance(tempVideoPath)
        .on('start', (commandLine: string) => {
          console.log('[Thumbnail Generator] FFmpeg command:', commandLine);
        })
        .on('error', async (error: any, stdout: any, stderr: any) => {
          console.error('[Thumbnail Generator] FFmpeg error:', error);
          console.error('[Thumbnail Generator] FFmpeg stderr:', stderr);
          
          // Fallback: Try direct FFmpeg command if fluent-ffmpeg fails
          if (error.message && error.message.includes('ffprobe')) {
            console.log('[Thumbnail Generator] Trying direct FFmpeg command as fallback...');
            
            try {
              const success = await generateThumbnailWithDirectCommand(tempVideoPath, tempThumbnailPath, {
                width,
                height,
                timeOffset: timeOffsetSeconds.toString(), // Use calculated seconds
                quality
              });
              
              if (success) {
                console.log('[Thumbnail Generator] Direct FFmpeg command succeeded!');
                
                // Read the generated thumbnail
                const thumbnailBuffer = fs.readFileSync(tempThumbnailPath);
                const stats = await statAsync(tempThumbnailPath);
                
                await cleanup();
                resolve({
                  success: true,
                  thumbnailBuffer,
                  width,
                  height,
                  fileSize: stats.size
                });
                return;
              }
            } catch (directError) {
              console.error('[Thumbnail Generator] Direct command also failed:', directError);
            }
          }
          
          cleanup().then(() => {
            resolve({
              success: false,
              error: error.message || 'FFmpeg processing failed'
            });
          });
        })
        .on('filenames', (filenames: string[]) => {
          console.log('[Thumbnail Generator] Generated files:', filenames);
        })
        .on('end', async () => {
          try {
            console.log('[Thumbnail Generator] FFmpeg processing completed');

            // Verifikasi file thumbnail dibuat
            if (!fs.existsSync(tempThumbnailPath)) {
              console.error('[Thumbnail Generator] Thumbnail file not found:', tempThumbnailPath);
              await cleanup();
              resolve({
                success: false,
                error: 'Thumbnail file was not created'
              });
              return;
            }

            // Baca thumbnail buffer
            const thumbnailBuffer = fs.readFileSync(tempThumbnailPath);
            const stats = await statAsync(tempThumbnailPath);

            console.log(`[Thumbnail Generator] Generated thumbnail: ${thumbnailBuffer.length} bytes`);

            await cleanup();
            resolve({
              success: true,
              thumbnailBuffer,
              width,
              height,
              fileSize: stats.size
            });

          } catch (error) {
            console.error('[Thumbnail Generator] Error processing result:', error);
            await cleanup();
            resolve({
              success: false,
              error: 'Failed to process thumbnail result'
            });
          }
        })
        .screenshots({
          count: 1,
          folder: path.dirname(tempThumbnailPath),
          filename: path.basename(tempThumbnailPath),
          size: `${width}x${height}`
        })
        .seekInput(timeOffsetSeconds) // Use calculated seconds instead of percentage
        .outputOptions([
          `-q:v ${quality}`,
          '-y', // Overwrite output file
          '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease` // Removed force_divisible_by for older FFmpeg compatibility
        ]);

    } catch (error) {
      console.error('[Thumbnail Generator] Error:', error);
      await cleanup();
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Cleanup function
    async function cleanup() {
      try {
        if (fs.existsSync(tempVideoPath)) {
          await unlinkAsync(tempVideoPath);
          console.log('[Thumbnail Generator] Cleaned up temp video file');
        }
        if (fs.existsSync(tempThumbnailPath)) {
          await unlinkAsync(tempThumbnailPath);
          console.log('[Thumbnail Generator] Cleaned up temp thumbnail file');
        }
      } catch (error) {
        console.error('[Thumbnail Generator] Cleanup error:', error);
      }
    }
  });
}

/**
 * Generate multiple thumbnails dari video pada waktu yang berbeda
 */
export function generateMultipleThumbnails(
  videoPath: string,
  outputDir: string,
  options: {
    count?: number;
    timeOffsets?: string[]; // ['5%', '25%', '50%', '75%', '95%']
    baseFilename?: string;
  } & ThumbnailGenerationOptions
): Promise<ThumbnailGenerationResult[]> {
  return new Promise(async (resolve) => {
    try {
      const {
        count = 5,
        timeOffsets,
        baseFilename = 'thumbnail',
        ...thumbnailOptions
      } = options;

      const offsets = timeOffsets || [
        '5%', '25%', '50%', '75%', '95%'
      ].slice(0, count);

      console.log(`[Thumbnail Generator] Generating ${offsets.length} thumbnails for ${videoPath}`);

      // Ensure output directory exists
      await ensureDirectoryExists(outputDir);

      const results: ThumbnailGenerationResult[] = [];

      for (let i = 0; i < offsets.length; i++) {
        const offset = offsets[i];
        const filename = `${baseFilename}_${i + 1}.${thumbnailOptions.outputFormat || 'jpg'}`;
        const outputPath = path.join(outputDir, filename);

        const result = await generateVideoThumbnail(videoPath, outputPath, {
          ...thumbnailOptions,
          timeOffset: offset
        });

        results.push(result);

        if (!result.success) {
          console.error(`[Thumbnail Generator] Failed to generate thumbnail ${i + 1}:`, result.error);
        }
      }

      resolve(results);

    } catch (error) {
      console.error('[Thumbnail Generator] Multiple thumbnails error:', error);
      resolve([{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }]);
    }
  });
}

// Add production environment check
function isProductionSafeForThumbnails(): boolean {
  // Check if we're in a serverless environment
  const isServerless = !!(
    process.env.VERCEL || 
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RENDER ||
    process.env.DYNO
  );
  
  if (isServerless) {
    console.log('[Thumbnail Generator] Serverless environment detected');
    return false;
  }
  
  // Check if FFmpeg is available
  try {
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
    const ffmpegExists = fs.existsSync(ffmpegInstaller.path);
    
    if (!ffmpegExists) {
      console.log('[Thumbnail Generator] FFmpeg binary not found in production');
      return false;
    }
    
    return true;
  } catch (error) {
    console.log('[Thumbnail Generator] FFmpeg installer not available:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Safe thumbnail generation for production environments
 */
export function generateThumbnailForCloudinary(
  videoBuffer: Buffer,
  options: ThumbnailGenerationOptions = {}
): Promise<ThumbnailGenerationResult> {
  return new Promise(async (resolve) => {
    try {
      // Production safety check
      if (!isProductionSafeForThumbnails()) {
        console.log('[Thumbnail Generator] Production environment not safe for thumbnail generation');
        resolve({
          success: false,
          error: 'Thumbnail generation not available in this environment. Please upload a thumbnail manually.',
          isProductionLimitation: true
        });
        return;
      }

      // Continue with original implementation
      console.log('[Thumbnail Generator] Production environment is safe, proceeding with generation');
      const result = await generateThumbnailFromBuffer(videoBuffer, options);
      resolve(result);
      
    } catch (error) {
      console.error('[Thumbnail Generator] Production error:', error);
      resolve({
        success: false,
        error: 'Thumbnail generation failed in production environment',
        details: error instanceof Error ? error.message : 'Unknown error',
        isProductionLimitation: true
      });
    }
  });
}

/**
 * Check if video file is valid for thumbnail generation
 */
export async function isVideoValidForThumbnail(videoPath: string): Promise<boolean> {
  return new Promise(async (resolve) => {
    try {
      // Check if file exists first
      if (!fs.existsSync(videoPath)) {
        console.error('[Thumbnail Generator] Video file does not exist:', videoPath);
        resolve(false);
        return;
      }

      // Initialize FFmpeg first
      const ffmpegInstance = await initFFmpeg();

      // Check if ffprobe is available
      if (!ffprobePath || !fs.existsSync(ffprobePath)) {
        console.warn('[Thumbnail Generator] FFprobe not available, skipping detailed video validation');
        console.log('[Thumbnail Generator] Assuming video is valid based on file existence');
        resolve(true); // Assume valid if file exists and we have FFmpeg
        return;
      }

      ffmpegInstance.ffprobe(videoPath, (error: any, metadata: any) => {
        if (error) {
          console.error('[Thumbnail Generator] Video probe error:', error);
          // Don't fail completely - try to proceed anyway
          console.warn('[Thumbnail Generator] Probe failed but proceeding with thumbnail generation');
          resolve(true);
          return;
        }

        // Check if video has video streams
        const hasVideoStream = metadata.streams.some((stream: any) => stream.codec_type === 'video');
        const duration = metadata.format.duration;

        // Video harus memiliki stream video dan durasi minimal 1 detik
        const isValid = hasVideoStream && duration !== undefined && duration > 1;
        
        console.log(`[Thumbnail Generator] Video validation:`, {
          hasVideoStream,
          duration,
          isValid
        });

        resolve(isValid);
      });
    } catch (error) {
      console.error('[Thumbnail Generator] Video validation error:', error);
      // Don't fail completely - assume valid and let FFmpeg handle it
      console.warn('[Thumbnail Generator] Validation error but proceeding anyway');
      resolve(true);
    }
  });
}

/**
 * Get optimal thumbnail dimensions based on video dimensions
 */
export async function getOptimalThumbnailDimensions(
  videoPath: string,
  maxWidth: number = 1280,
  maxHeight: number = 720
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    try {
      // Check if file exists first
      if (!fs.existsSync(videoPath)) {
        console.error('[Thumbnail Generator] Video file does not exist for dimension check:', videoPath);
        resolve({ width: maxWidth, height: maxHeight });
        return;
      }

      ffmpeg.ffprobe(videoPath, (error: any, metadata: any) => {
        if (error) {
          console.error('[Thumbnail Generator] Video dimensions probe error:', error);
          resolve(null);
          return;
        }

        const videoStream = metadata.streams.find((stream: any) => stream.codec_type === 'video');
        
        if (!videoStream || !videoStream.width || !videoStream.height) {
          console.warn('[Thumbnail Generator] Could not get video dimensions');
          resolve({ width: maxWidth, height: maxHeight });
          return;
        }

        const { width: videoWidth, height: videoHeight } = videoStream;
        
        // Calculate optimal dimensions maintaining aspect ratio
        const aspectRatio = videoWidth / videoHeight;
        
        let thumbnailWidth = maxWidth;
        let thumbnailHeight = Math.round(maxWidth / aspectRatio);
        
        if (thumbnailHeight > maxHeight) {
          thumbnailHeight = maxHeight;
          thumbnailWidth = Math.round(maxHeight * aspectRatio);
        }

        console.log(`[Thumbnail Generator] Optimal dimensions:`, {
          original: { width: videoWidth, height: videoHeight },
          thumbnail: { width: thumbnailWidth, height: thumbnailHeight },
          aspectRatio
        });

        resolve({
          width: thumbnailWidth,
          height: thumbnailHeight
        });
      });
    } catch (error) {
      console.error('[Thumbnail Generator] Dimension calculation error:', error);
      resolve({ width: maxWidth, height: maxHeight });
    }
  });
}

/**
 * Generate thumbnail using direct FFmpeg command (fallback method)
 */
async function generateThumbnailWithDirectCommand(
  inputPath: string,
  outputPath: string,
  options: {
    width: number;
    height: number;
    timeOffset: string;
    quality: number;
  }
): Promise<boolean> {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  return new Promise(async (resolve) => {
    try {
      if (!ffmpegPath) {
        throw new Error('FFmpeg path not initialized');
      }
      
      // Parse time offset - should already be in seconds
      let seekTime = '10'; // Default to 10 seconds
      if (options.timeOffset) {
        // Clean up and validate the time offset
        const cleanTimeOffset = options.timeOffset.replace(/[^0-9.]/g, '');
        const parsedTime = parseFloat(cleanTimeOffset);
        if (!isNaN(parsedTime) && parsedTime >= 0) {
          seekTime = parsedTime.toString();
        }
      }
      
      // Use a simple, reliable FFmpeg command compatible with older versions
      const command = [
        `"${ffmpegPath}"`,
        `-ss ${seekTime}`,
        `-i "${inputPath}"`,
        `-vframes 1`,
        `-vf "scale=${options.width}:${options.height}:force_original_aspect_ratio=decrease"`, // Removed force_divisible_by
        `-q:v ${Math.max(2, Math.min(31, Math.floor(31 - (options.quality * 0.3))))}`, // Convert quality to FFmpeg scale (2-31, lower is better)
        `-y`,
        `"${outputPath}"`
      ].join(' ');
      
      console.log('[Thumbnail Generator] Direct FFmpeg command:', command);
      
      const { stdout, stderr } = await execAsync(command, { 
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      if (stderr) {
        console.log('[Thumbnail Generator] FFmpeg stderr (info):', stderr);
      }
      
      if (stdout) {
        console.log('[Thumbnail Generator] FFmpeg stdout:', stdout);
      }
      
      // Check if output file was created and has content
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        if (stats.size > 0) {
          console.log(`[Thumbnail Generator] Direct command created thumbnail successfully (${stats.size} bytes)`);
          resolve(true);
        } else {
          console.error('[Thumbnail Generator] Direct command created empty thumbnail file');
          resolve(false);
        }
      } else {
        console.error('[Thumbnail Generator] Direct command failed to create thumbnail file');
        resolve(false);
      }
      
    } catch (error) {
      console.error('[Thumbnail Generator] Direct command execution error:', error);
      resolve(false);
    }
  });
} 