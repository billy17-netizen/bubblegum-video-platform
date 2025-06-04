// Thumbnail Cache Utility
// This utility helps invalidate caches and force refresh thumbnails

export class ThumbnailCacheManager {
  private static instance: ThumbnailCacheManager;
  private cache = new Map<string, string>();
  private lastClearTime = 0;

  public static getInstance(): ThumbnailCacheManager {
    if (!ThumbnailCacheManager.instance) {
      ThumbnailCacheManager.instance = new ThumbnailCacheManager();
    }
    return ThumbnailCacheManager.instance;
  }

  // Clear all cached thumbnails
  public clearCache(): void {
    this.cache.clear();
    this.lastClearTime = Date.now();
    console.log('🔄 Thumbnail cache cleared');
  }

  // Get cache-busted URL for a thumbnail
  public getCacheBustedUrl(thumbnailUrl: string): string {
    if (!thumbnailUrl) return '';
    
    // Add timestamp to force reload
    const separator = thumbnailUrl.includes('?') ? '&' : '?';
    return `${thumbnailUrl}${separator}t=${this.lastClearTime}`;
  }

  // Refresh thumbnail for specific video
  public refreshThumbnail(videoId: string): void {
    // Remove from cache to force reload
    this.cache.delete(videoId);
    console.log(`🔄 Thumbnail cache refreshed for video: ${videoId}`);
  }

  // Check if file exists (server-side only)
  public async fileExists(filePath: string): Promise<boolean> {
    if (typeof window !== 'undefined') {
      // Client-side: can't check file system
      return true;
    }
    
    try {
      // Dynamic import to prevent bundling fs on client-side
      const { existsSync } = await import('fs');
      return existsSync(filePath);
    } catch (error) {
      console.warn('File system check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const thumbnailCacheManager = ThumbnailCacheManager.getInstance();