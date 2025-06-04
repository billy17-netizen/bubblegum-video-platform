// Bubblegum Video Cache Service Worker - Version with Cache Busting
const CACHE_VERSION = Date.now(); // Dynamic cache version
const CACHE_NAME = `bubblegum-cache-v${CACHE_VERSION}`;
const VIDEO_CACHE_NAME = `bubblegum-videos-v${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `bubblegum-static-v${CACHE_VERSION}`;

// Cache strategies for different content types
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json'
];

// Assets that should NEVER be cached (always fetch fresh)
const NEVER_CACHE = [
  '/api/',
  '/_next/static/chunks/',
  '/_next/static/css/',
  '/globals.css'
];

// Install event - cache static assets with immediate activation
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker with cache version:', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching essential static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Service worker installed successfully');
        // Skip waiting to activate immediately when new version available
        self.skipWaiting();
      })
  );
});

// Activate event - aggressive cleanup of old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    Promise.all([
      // Clear all old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!cacheName.includes(CACHE_VERSION.toString())) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ]).then(() => {
      console.log('[SW] Service worker activated and took control');
      
      // Notify all clients about update
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            payload: 'Service worker updated successfully'
          });
        });
      });
    })
  );
});

// Fetch event - implement cache-busting strategies
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip caching for certain paths
  if (NEVER_CACHE.some(path => url.pathname.includes(path))) {
    event.respondWith(fetchWithCacheBust(event.request));
    return;
  }
  
  // Handle video streaming requests
  if (url.pathname.includes('/api/videos/') && url.pathname.includes('/stream')) {
    event.respondWith(handleVideoRequest(event.request));
    return;
  }
  
  // Handle static assets with cache busting
  if (event.request.method === 'GET') {
    event.respondWith(handleStaticRequestWithBusting(event.request));
  }
});

// Cache-busting fetch for critical resources
async function fetchWithCacheBust(request) {
  try {
    // Add cache-busting parameter for CSS and JS files
    const url = new URL(request.url);
    if (url.pathname.includes('.css') || url.pathname.includes('.js') || url.pathname.includes('/_next/')) {
      url.searchParams.set('v', CACHE_VERSION.toString());
      const bustRequest = new Request(url.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
        mode: request.mode,
        credentials: request.credentials,
        cache: 'no-cache' // Force fresh fetch
      });
      
      console.log('[SW] Cache-busting fetch for:', url.pathname);
      return await fetch(bustRequest);
    }
    
    // For other requests, just fetch fresh
    return await fetch(request, { cache: 'no-cache' });
    
  } catch (error) {
    console.error('[SW] Cache-bust fetch failed:', error);
    return new Response('Resource not available', { 
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Enhanced video request handling with cache invalidation
async function handleVideoRequest(request) {
  const url = new URL(request.url);
  const cacheKey = `${url.pathname}${url.search}`;
  
  try {
    // For video content, try network first to get fresh content
    console.log('[SW] Fetching video from network (fresh):', cacheKey);
    const networkResponse = await fetch(request, { cache: 'no-cache' });
    
    // Cache successful responses (but not range requests for large videos)
    if (networkResponse.ok && !request.headers.get('range')) {
      const responseToCache = networkResponse.clone();
      const cache = await caches.open(VIDEO_CACHE_NAME);
      
      // Only cache smaller video files and metadata
      const contentLength = parseInt(networkResponse.headers.get('content-length') || '0');
      if (contentLength < 50 * 1024 * 1024) { // Cache files smaller than 50MB
        console.log('[SW] Caching video response:', cacheKey);
        cache.put(request, responseToCache);
      }
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('[SW] Error handling video request:', error);
    
    // Fallback to cache only if network fails
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving video from cache (fallback):', cacheKey);
      return cachedResponse;
    }
    
    return new Response('Video not available offline', { 
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Enhanced static assets handling with intelligent cache busting
async function handleStaticRequestWithBusting(request) {
  const url = new URL(request.url);
  
  try {
    // For API requests, always fetch fresh
    if (url.pathname.startsWith('/api/')) {
      return await fetchWithCacheBust(request);
    }
    
    // For CSS, JS, and Next.js chunks, check cache with timestamp validation
    if (url.pathname.includes('.css') || url.pathname.includes('.js') || url.pathname.includes('/_next/')) {
      return await handleCriticalAsset(request);
    }
    
    // For other static assets, try cache first but validate freshness
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Check if cached response is recent (less than 1 hour old)
      const cacheDate = new Date(cachedResponse.headers.get('date') || 0);
      const hourAgo = Date.now() - (60 * 60 * 1000);
      
      if (cacheDate.getTime() > hourAgo) {
        console.log('[SW] Serving fresh cache:', url.pathname);
        return cachedResponse;
      } else {
        console.log('[SW] Cache expired, fetching fresh:', url.pathname);
      }
    }
    
    // Fetch from network and cache
    const networkResponse = await fetch(request, { cache: 'no-cache' });
    
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, responseToCache);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('[SW] Error handling static request:', error);
    
    // Fallback to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    
    return new Response('Resource not available offline', { 
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Handle critical assets (CSS/JS) with aggressive freshness checking
async function handleCriticalAsset(request) {
  try {
    // Always try to fetch fresh version first
    console.log('[SW] Fetching fresh critical asset:', request.url);
    const networkResponse = await fetch(request, { 
      cache: 'no-cache',
      headers: {
        ...Object.fromEntries(request.headers),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
    if (networkResponse.ok) {
      // Cache the fresh version
      const responseToCache = networkResponse.clone();
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, responseToCache);
      
      return networkResponse;
    }
    
    throw new Error('Network response not ok');
    
  } catch (error) {
    console.error('[SW] Failed to fetch critical asset:', error);
    
    // Fallback to cache only if network completely fails
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Using cached version of critical asset');
      return cachedResponse;
    }
    
    return new Response('Critical asset not available', { 
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// API requests strategy - always fetch fresh in production
async function handleApiRequest(request) {
  try {
    const networkResponse = await fetch(request, { 
      cache: 'no-cache',
      headers: {
        ...Object.fromEntries(request.headers),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
    return networkResponse;
    
  } catch (error) {
    console.error('[SW] API request failed:', error);
    
    // Only fallback to cache for GET requests and if explicitly allowed
    if (request.method === 'GET' && !request.url.includes('auth')) {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        console.log('[SW] Serving API response from cache (emergency fallback)');
        return cachedResponse;
      }
    }
    
    return new Response('API not available', { 
      status: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'API not available offline' })
    });
  }
}

// Message handling for client communication
self.addEventListener('message', (event) => {
  if (event.data.type === 'CLEAR_CACHE') {
    console.log('[SW] Received clear cache request');
    clearAllCaches().then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
  
  if (event.data.type === 'FORCE_UPDATE') {
    console.log('[SW] Received force update request');
    self.skipWaiting();
  }
});

// Sync event for background data sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'video-analytics') {
    event.waitUntil(syncVideoAnalytics());
  }
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// Background sync for video analytics
async function syncVideoAnalytics() {
  console.log('[SW] Syncing video analytics...');
  // Implementation for analytics sync
}

// Get pending analytics data
async function getPendingAnalytics() {
  // Implementation for getting pending analytics
  return [];
}

// Remove synced analytics
async function removePendingAnalytics(id) {
  // Implementation for removing analytics
}

// Clear all caches - enhanced version
async function clearAllCaches() {
  console.log('[SW] Clearing all caches...');
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(cacheName => {
      console.log('[SW] Deleting cache:', cacheName);
      return caches.delete(cacheName);
    })
  );
  console.log('[SW] All caches cleared');
}

// Preload video function
async function preloadVideo(videoUrl) {
  try {
    console.log('[SW] Preloading video:', videoUrl);
    const cache = await caches.open(VIDEO_CACHE_NAME);
    const response = await fetch(videoUrl);
    if (response.ok) {
      await cache.put(videoUrl, response);
      console.log('[SW] Video preloaded successfully');
    }
  } catch (error) {
    console.error('[SW] Video preload failed:', error);
  }
}

// Background sync implementation
function doBackgroundSync() {
  console.log('[SW] Performing background sync...');
  // Implementation for background sync
} 