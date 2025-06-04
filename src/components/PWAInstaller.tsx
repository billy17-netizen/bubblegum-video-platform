"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { FaTimes, FaDownload, FaMobile } from "react-icons/fa";
import { 
  wasPromptShownThisSession,
  markPromptShownThisSession,
  isNewLoginSession,
  markUserLoggedInThisSession,
  isPWAPermanentlyDismissed,
  markPWAPermanentlyDismissed,
  PWA_STORAGE_KEYS,
  initPWAUtils,
  resetPWAPermanentDismissal
} from "@/lib/pwaUtils";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const PWAInstaller = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Check if user is admin or on admin route
  const isAdminRoute = pathname?.startsWith('/admin');
  const isAdminUser = session?.user?.email?.includes('admin'); // Adjust based on your admin detection logic
  const isDebugMode = process.env.NODE_ENV === 'development' || 
                     (typeof window !== 'undefined' && window.location.search.includes('debug=pwa'));
  
  // Special override for forcing PWA test (only works with specific URL param)
  const forceTestPWA = typeof window !== 'undefined' && window.location.search.includes('force-pwa-test=true');

  // Initialize PWA utils for debugging
  useEffect(() => {
    initPWAUtils();
  }, []);

  useEffect(() => {
    console.log("[PWA] PWAInstaller useEffect triggered");
    console.log("[PWA] Current status - Admin route:", isAdminRoute, "Admin user:", isAdminUser, "Auth status:", status);
    console.log("[PWA] Permanent dismissal status:", isPWAPermanentlyDismissed());
    
    // Skip PWA for admin users or admin routes
    if (isAdminRoute || isAdminUser) {
      setDebugInfo("Admin user/route - PWA disabled");
      console.log("[PWA] Skipping PWA for admin");
      return;
    }

    // Don't show if authentication is still loading
    if (status === 'loading') {
      console.log("[PWA] Auth still loading, waiting...");
      return;
    }

    // Don't show if user is not authenticated
    if (status === 'unauthenticated' || !session?.user) {
      setDebugInfo("User not authenticated - PWA disabled");
      console.log("[PWA] User not authenticated, skipping PWA");
      return;
    }

    // FIRST PRIORITY: Check if user permanently dismissed PWA - this overrides everything including debug mode
    if (isPWAPermanentlyDismissed() && !forceTestPWA) {
      setDebugInfo("PWA permanently dismissed by user - will never show again");
      console.log("[PWA] PWA permanently dismissed, will never show again");
      return;
    }

    // Check if app is already installed
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      setDebugInfo("App already installed");
      return;
    }

    // Check if we already showed the prompt during this login session
    const promptShownThisSession = wasPromptShownThisSession();

    // If user just logged in (not yet marked as logged in this session), mark it
    if (isNewLoginSession()) {
      markUserLoggedInThisSession();
      setDebugInfo("User just logged in - marking session");
    } else if (promptShownThisSession && !isDebugMode) {
      setDebugInfo("PWA prompt already shown this session");
      return;
    }

    // Check if PWA criteria are met
    const checkPWACriteria = () => {
      const hasManifest = document.querySelector('link[rel="manifest"]');
      const hasServiceWorker = 'serviceWorker' in navigator;
      const isHTTPS = location.protocol === 'https:' || location.hostname === 'localhost';
      
      setDebugInfo(`PWA Check: Manifest=${!!hasManifest}, SW=${hasServiceWorker}, HTTPS=${isHTTPS}`);
      
      return hasManifest && hasServiceWorker && isHTTPS;
    };

    // Wait for page to fully load before checking PWA criteria
    const initializePWA = () => {
      if (!checkPWACriteria()) {
        setDebugInfo("PWA criteria not met");
        return;
      }

      // Listen for beforeinstallprompt event
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setDebugInfo("Install prompt ready from browser");
        
        // Show install prompt after a delay for newly logged in users
        const delay = isDebugMode ? 3000 : 8000; // 3s for debug, 8s for normal (shorter since it's only once per login)
        setTimeout(() => {
          // Double-check permanent dismissal before showing
          if (isPWAPermanentlyDismissed() && !forceTestPWA) {
            setDebugInfo("PWA permanently dismissed - canceling prompt");
            return;
          }
          
          if (!promptShownThisSession || isDebugMode) {
            setShowInstallPrompt(true);
            markPromptShownThisSession();
            setDebugInfo("Install prompt shown for this login session");
          }
        }, delay);
      };

      // Listen for app installed event
      const handleAppInstalled = () => {
        setIsInstalled(true);
        setShowInstallPrompt(false);
        setDeferredPrompt(null);
        setDebugInfo("App installed successfully");
        localStorage.setItem(PWA_STORAGE_KEYS.INSTALLED, 'true');
      };

      setDebugInfo("Waiting for browser install prompt event...");
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);

      // For debug mode or fallback, show manual install after longer wait
      if (isDebugMode) {
        setTimeout(() => {
          // Double-check permanent dismissal before showing
          if (isPWAPermanentlyDismissed() && !forceTestPWA) {
            setDebugInfo("PWA permanently dismissed - canceling debug prompt");
            return;
          }
          
          if (!deferredPrompt && !isInstalled && !promptShownThisSession) {
            setShowInstallPrompt(true);
            markPromptShownThisSession();
            setDebugInfo("Debug: Manual install available (no browser prompt)");
          }
        }, 5000);
      } else {
        // For production, wait longer before showing manual install (only if not shown this session)
        setTimeout(() => {
          // Double-check permanent dismissal before showing
          if (isPWAPermanentlyDismissed() && !forceTestPWA) {
            setDebugInfo("PWA permanently dismissed - canceling timeout prompt");
            return;
          }
          
          if (!deferredPrompt && !isInstalled && !promptShownThisSession) {
            setShowInstallPrompt(true);
            markPromptShownThisSession();
            setDebugInfo("Manual install available (timeout)");
          }
        }, 15000); // 15 seconds wait
      }

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    };

    // Wait for DOM to be ready
    if (document.readyState === 'complete') {
      return initializePWA();
    } else {
      window.addEventListener('load', initializePWA);
      return () => window.removeEventListener('load', initializePWA);
    }
  }, [isAdminRoute, isAdminUser, isDebugMode, deferredPrompt, isInstalled, session, status]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      setDebugInfo("Debug: No install prompt available - trying manual add to home screen");
      alert("Untuk menginstall:\n\n1. Chrome: Menu (⋮) → 'Install app' atau 'Add to Home screen'\n2. Safari: Share (↗) → 'Add to Home Screen'\n3. Firefox: Menu → 'Install'\n\nAtau coba refresh halaman dan tunggu install prompt muncul.");
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        setDebugInfo("User accepted install");
        console.log('User accepted the install prompt');
      } else {
        setDebugInfo("User dismissed install");
        console.log('User dismissed the install prompt');
      }
    } catch (error) {
      setDebugInfo("Error showing install prompt");
      console.error('Error showing install prompt:', error);
    }

    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismissClick = () => {
    setShowInstallPrompt(false);
    setDebugInfo("Install prompt dismissed this session");
    // Don't set any permanent flags - will show again on next login
  };

  const handleNeverShowClick = () => {
    console.log("[PWA] User clicked 'Jangan tampilkan lagi' - permanently dismissing PWA install prompt");
    
    // Immediately hide the prompt
    setShowInstallPrompt(false);
    
    // Mark as permanently dismissed
    markPWAPermanentlyDismissed();
    
    // Verify it was saved
    const isDismissed = isPWAPermanentlyDismissed();
    console.log("[PWA] Permanent dismissal saved:", isDismissed);
    
    setDebugInfo("Install prompt permanently dismissed - will never show again");
    
    // Force clear any timeouts or deferred prompts
    setDeferredPrompt(null);
  };

  // Only show install prompt for authenticated users, once per session
  if (showInstallPrompt && !isInstalled && !isAdminRoute && !isAdminUser && session?.user) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-sm">
        <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl p-4 shadow-2xl border border-white/20 backdrop-blur-sm">
          <button
            onClick={handleDismissClick}
            className="absolute top-2 right-2 text-white/80 hover:text-white"
          >
            <FaTimes size={14} />
          </button>
          
          <div className="flex items-start space-x-3">
            <div className="bg-white/20 rounded-full p-2 flex-shrink-0">
              <FaMobile className="text-white text-lg" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-sm mb-1">
                Install Bubblegum App
              </h3>
              <p className="text-white/90 text-xs mb-3 leading-relaxed">
                Nikmati pengalaman terbaik dengan menginstall app Bubblegum di perangkat Anda!
              </p>
              
              <div className="flex flex-col space-y-2">
                <div className="flex space-x-2">
                  <button
                    onClick={handleInstallClick}
                    className="flex items-center space-x-1 bg-white text-pink-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors"
                  >
                    <FaDownload size={12} />
                    <span>Install</span>
                  </button>
                  
                  <button
                    onClick={handleDismissClick}
                    className="text-white/80 text-xs hover:text-white px-2 py-1.5"
                  >
                    Nanti
                  </button>
                </div>
                
                <button
                  onClick={handleNeverShowClick}
                  className="text-white/60 text-xs hover:text-white/80 underline text-left"
                >
                  Jangan tampilkan lagi
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default PWAInstaller; 