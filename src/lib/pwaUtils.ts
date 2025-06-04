// PWA Session Management Utilities

export const PWA_SESSION_KEYS = {
  PROMPT_SHOWN: 'bubblegum_pwa_prompt_shown_this_session',
  USER_LOGGED_IN: 'bubblegum_user_logged_in_this_session'
} as const;

export const PWA_STORAGE_KEYS = {
  PERMANENTLY_DISMISSED: 'bubblegum_pwa_permanently_dismissed',
  INSTALLED: 'bubblegum_pwa_installed'
} as const;

/**
 * Clear PWA session storage - call this when user logs out
 */
export const clearPWASession = () => {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(PWA_SESSION_KEYS.PROMPT_SHOWN);
    sessionStorage.removeItem(PWA_SESSION_KEYS.USER_LOGGED_IN);
  }
};

/**
 * Check if PWA prompt was already shown in this session
 */
export const wasPromptShownThisSession = (): boolean => {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(PWA_SESSION_KEYS.PROMPT_SHOWN) === 'true';
};

/**
 * Mark PWA prompt as shown in this session
 */
export const markPromptShownThisSession = () => {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(PWA_SESSION_KEYS.PROMPT_SHOWN, 'true');
  }
};

/**
 * Check if this is a new login session
 */
export const isNewLoginSession = (): boolean => {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(PWA_SESSION_KEYS.USER_LOGGED_IN) !== 'true';
};

/**
 * Mark user as logged in for this session
 */
export const markUserLoggedInThisSession = () => {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(PWA_SESSION_KEYS.USER_LOGGED_IN, 'true');
  }
};

/**
 * Check if user permanently dismissed PWA install prompt
 */
export const isPWAPermanentlyDismissed = (): boolean => {
  if (typeof window === 'undefined') return false;
  const isDismissed = localStorage.getItem(PWA_STORAGE_KEYS.PERMANENTLY_DISMISSED) === 'true';
  console.log("[PWA Utils] Checking permanent dismissal:", isDismissed);
  return isDismissed;
};

/**
 * Mark PWA as permanently dismissed
 */
export const markPWAPermanentlyDismissed = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(PWA_STORAGE_KEYS.PERMANENTLY_DISMISSED, 'true');
    console.log("[PWA Utils] Marked PWA as permanently dismissed");
  }
};

/**
 * Reset permanent dismissal (for testing purposes)
 * Call this in browser console: window.resetPWADismissal()
 */
export const resetPWAPermanentDismissal = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(PWA_STORAGE_KEYS.PERMANENTLY_DISMISSED);
    console.log("[PWA Utils] Reset permanent dismissal - PWA prompts will show again");
    
    // Also expose this function globally for easy testing
    (window as any).resetPWADismissal = resetPWAPermanentDismissal;
  }
};

/**
 * Initialize PWA utils - call this once to set up debugging helpers
 */
export const initPWAUtils = () => {
  if (typeof window !== 'undefined') {
    // Expose debugging functions globally
    (window as any).resetPWADismissal = resetPWAPermanentDismissal;
    (window as any).checkPWADismissed = isPWAPermanentlyDismissed;
    (window as any).clearPWASession = clearPWASession;
    
    console.log("[PWA Utils] Debugging functions available:");
    console.log("- window.resetPWADismissal() - Reset permanent dismissal");
    console.log("- window.checkPWADismissed() - Check dismissal status");
    console.log("- window.clearPWASession() - Clear session storage");
  }
}; 