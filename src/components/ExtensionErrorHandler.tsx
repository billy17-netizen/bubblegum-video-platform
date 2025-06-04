"use client";

import { useEffect } from 'react';
import { setupGlobalExtensionErrorHandling } from '@/lib/hydration-utils';

/**
 * Global error handler component for browser extension interference
 * This should be included in the root layout to handle cross-origin errors
 */
export default function ExtensionErrorHandler() {
  useEffect(() => {
    // Set up global error handling for extension-related errors
    setupGlobalExtensionErrorHandling();
  }, []);

  // This component doesn't render anything
  return null;
} 