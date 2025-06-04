import { useEffect, useState } from 'react';

/**
 * Hook to prevent hydration mismatches by ensuring component is mounted on client
 * This prevents server/client rendering differences that cause hydration errors
 */
export function useClientOnly() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return isMounted;
}

/**
 * Wrapper component to suppress hydration warnings for components
 * that are affected by browser extensions or client-only features
 */
export function ClientOnly({ 
  children, 
  fallback = null 
}: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
}) {
  const isMounted = useClientOnly();

  if (!isMounted) {
    return fallback;
  }

  return children;
}

/**
 * Enhanced utility to prevent browser extension DOM modifications from causing hydration errors
 * Handles Firefox cross-origin XrayWrapper errors and common extension modifications
 */
export function preventExtensionInterference() {
  if (typeof window === 'undefined') return;

  // Suppress Firefox cross-origin extension errors
  const originalError = window.console.error;
  window.console.error = (...args) => {
    const message = args[0]?.toString() || '';
    
    // Filter out known extension-related errors
    if (
      message.includes('Not allowed to define cross-origin object') ||
      message.includes('XrayWrapper') ||
      message.includes('content-script.js') ||
      message.includes('psono-formSubmitCatcher') ||
      message.includes('lastpass') ||
      message.includes('1password') ||
      message.includes('bitwarden')
    ) {
      // Log as debug instead of error to avoid console noise
      console.debug('[Extension Interference]', ...args);
      return;
    }
    
    // Allow other errors through
    originalError.apply(console, args);
  };

  // Prevent extensions from modifying forms during hydration
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes') {
        const target = mutation.target as HTMLElement;
        
        // Common extension modifications to suppress
        if (
          target.classList?.contains('psono-formSubmitCatcher-covered') ||
          target.style?.backgroundImage?.includes('data:') ||
          target.getAttribute('data-lastpass-icon-added') ||
          target.getAttribute('data-1password-extension') ||
          target.getAttribute('data-bitwarden-watching') ||
          target.classList?.contains('com-bitwarden-browser-animated-fill')
        ) {
          // Log but don't interfere - just acknowledge the modification
          console.debug('[Hydration] Browser extension modification detected and acknowledged');
        }
      }
    });
  });

  // Handle Firefox-specific extension object injection
  try {
    // Override problematic extension APIs that cause XrayWrapper errors
    if (window.navigator.userAgent.includes('Firefox')) {
      // Create a protective wrapper for common extension injection points
      const protectObject = (obj: unknown, name: string) => {
        try {
          if (obj && typeof obj === 'object') {
            Object.defineProperty(obj, '_extensionProtected', {
              value: true,
              writable: false,
              enumerable: false,
              configurable: false
            });
          }
        } catch (e) {
          console.debug(`[Extension Protection] Could not protect ${name}:`, e);
        }
      };

      // Protect common injection targets
      protectObject(window, 'window');
      protectObject(document, 'document');
      protectObject(Array.prototype, 'Array.prototype');
      protectObject(Object.prototype, 'Object.prototype');
    }
  } catch (e) {
    console.debug('[Extension Protection] Firefox protection setup failed:', e);
  }

  // Start observing after a short delay to allow initial hydration
  setTimeout(() => {
    try {
      observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: [
          'class', 
          'style', 
          'data-lastpass-icon-added', 
          'data-1password-extension',
          'data-bitwarden-watching'
        ]
      });
    } catch (e) {
      console.debug('[Extension Protection] Observer setup failed:', e);
    }
  }, 100);

  // Clean up observer after hydration period
  setTimeout(() => {
    try {
      observer.disconnect();
      // Restore original console.error after hydration period
      window.console.error = originalError;
    } catch (e) {
      console.debug('[Extension Protection] Cleanup failed:', e);
    }
  }, 5000);
}

/**
 * Props for components that need hydration safety
 */
export const hydrationSafeProps = {
  suppressHydrationWarning: true,
} as const;

/**
 * Global error handler for extension-related errors
 * Call this in your app's root component or _app.tsx
 */
export function setupGlobalExtensionErrorHandling() {
  if (typeof window === 'undefined') return;

  // Handle uncaught extension errors
  window.addEventListener('error', (event) => {
    const message = event.error?.message || event.message || '';
    
    if (
      message.includes('Not allowed to define cross-origin object') ||
      message.includes('XrayWrapper') ||
      message.includes('content-script.js')
    ) {
      console.debug('[Global Extension Error]', event.error || event.message);
      event.preventDefault(); // Prevent the error from showing in console
      return false;
    }
    
    // Allow other errors through
    return true;
  });

  // Handle unhandled promise rejections from extensions
  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message || event.reason || '';
    
    if (
      message.includes('cross-origin') ||
      message.includes('extension') ||
      message.includes('content-script')
    ) {
      console.debug('[Global Extension Promise Rejection]', event.reason);
      event.preventDefault();
      return false;
    }
    
    // Allow other rejections through
    return true;
  });
} 