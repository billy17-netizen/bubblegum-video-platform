"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const PWARegister = () => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [swStatus, setSwStatus] = useState<string>("");
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Skip service worker registration for admin routes or admin users
    const isAdminRoute = pathname?.startsWith('/admin');
    const isAdminUser = session?.user?.email?.includes('admin');

    if (isAdminRoute || isAdminUser) {
      setSwStatus("Admin user - PWA disabled");
      return;
    }

    // Register service worker for all users (development and production)
    if ('serviceWorker' in navigator) {
      const registerSW = async () => {
        try {
          setSwStatus("Registering service worker...");
          
          // Force update check on every page load
          const registration = await navigator.serviceWorker.register('/sw.js', {
            updateViaCache: 'none' // Never use cache for service worker file
          });
          
          setSwStatus("Service worker registered successfully! PWA ready.");
          console.log('SW registered: ', registration);

          // Force immediate update check
          registration.update();

          // Listen for service worker updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              console.log('New service worker found, installing...');
              
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // New content available
                    console.log('New content available, prompting for update');
                    setUpdateAvailable(true);
                    setSwStatus("Update tersedia!");
                    
                    // Show update notification
                    if (confirm('Versi baru aplikasi tersedia! Refresh untuk menggunakan versi terbaru?')) {
                      // Clear all caches before reload
                      clearAllCaches().then(() => {
                        window.location.reload();
                      });
                    }
                  } else {
                    // Content cached for offline use
                    console.log('Content cached for offline use');
                    setSwStatus("Aplikasi siap offline!");
                  }
                }
              });
            }
          });

          // Listen for service worker messages
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data.type === 'SW_UPDATED') {
              console.log('Service worker updated:', event.data.payload);
              setUpdateAvailable(true);
            }
          });

          // Check for existing service worker
          if (registration.waiting) {
            console.log('Service worker waiting, prompting for update');
            setUpdateAvailable(true);
            if (confirm('Update aplikasi tersedia! Refresh sekarang?')) {
              registration.waiting.postMessage({ type: 'FORCE_UPDATE' });
              window.location.reload();
            }
          }

          // Check for controlling service worker
          if (registration.active && !navigator.serviceWorker.controller) {
            console.log('Service worker active but not controlling, reloading...');
            window.location.reload();
          }

        } catch (error) {
          setSwStatus("Service worker registration failed");
          console.log('SW registration failed: ', error);
        }
      };

      // Register immediately
      registerSW();

      // Also check for updates when page becomes visible
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          navigator.serviceWorker.getRegistration('/sw.js').then(registration => {
            if (registration) {
              registration.update();
            }
          });
        }
      });

    } else {
      setSwStatus("Service workers not supported");
    }
  }, [pathname, session]);

  // Function to clear all caches
  const clearAllCaches = async () => {
    try {
      console.log('Clearing all caches...');
      
      // Clear service worker caches
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const messageChannel = new MessageChannel();
        
        return new Promise((resolve) => {
          messageChannel.port1.onmessage = (event) => {
            console.log('Cache clear response:', event.data);
            resolve(event.data);
          };
          
          const controller = navigator.serviceWorker.controller;
          if (controller) {
            controller.postMessage(
              { type: 'CLEAR_CACHE' },
              [messageChannel.port2]
            );
          }
        });
      }
      
      // Clear browser caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => {
            console.log('Deleting cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }
      
      // Clear local storage cache items
      Object.keys(localStorage).forEach(key => {
        if (key.includes('cache') || key.includes('bubblegum')) {
          localStorage.removeItem(key);
        }
      });
      
      console.log('All caches cleared successfully');
      
    } catch (error) {
      console.error('Error clearing caches:', error);
    }
  };

  // Function to force refresh (can be called from outside)
  useEffect(() => {
    // Make clearAllCaches available globally for debugging
    (window as any).clearAllCaches = clearAllCaches;
    
    // Add force refresh function
    (window as any).forceRefresh = () => {
      clearAllCaches().then(() => {
        window.location.reload();
      });
    };
  }, []);

  // Show update notification if available
  if (updateAvailable) {
    return (
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
        <div className="flex items-center space-x-2">
          <span>🔄 Update tersedia!</span>
          <button 
            onClick={() => {
              clearAllCaches().then(() => {
                window.location.reload();
              });
            }}
            className="bg-white text-blue-600 px-2 py-1 rounded text-sm font-semibold"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  // Debug info is not displayed but status is tracked
  return null;
};

export default PWARegister; 