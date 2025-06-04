"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FaMobile, FaTabletAlt, FaDesktop, FaExclamationTriangle } from "react-icons/fa";

export default function MobileOnlyMessage() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [showBlocker, setShowBlocker] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      const isDesktopSize = width >= 768; // Tablets and larger
      setIsDesktop(isDesktopSize);
      setShowBlocker(isDesktopSize);
    };

    // Check on mount
    checkScreenSize();

    // Listen for resize events
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Block desktop/tablet users completely
  if (showBlocker && isDesktop) {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-600 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 to-pink-600 p-6 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="flex justify-center mb-4"
            >
              <div className="relative">
                <FaExclamationTriangle className="text-white text-4xl" />
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full"
                />
              </div>
            </motion.div>
            
            <h2 className="text-2xl font-bold text-white mb-2">
              🚫 Mobile Only Access
            </h2>
            <p className="text-red-100 text-sm">
              This application is restricted to mobile devices only
            </p>
          </div>
          
          {/* Content */}
          <div className="p-6 space-y-4">
            <div className="text-center">
              <p className="text-gray-300 text-base leading-relaxed mb-4">
                <span className="font-bold text-pink-400">Bubblegum</span> is exclusively designed for <strong>mobile phones</strong> and cannot be accessed from desktop or tablet devices.
              </p>
              
              <div className="grid grid-cols-3 gap-3 my-6">
                <div className="text-center opacity-50">
                  <FaDesktop className="text-red-400 text-2xl mx-auto mb-2" />
                  <span className="text-xs text-red-400">Desktop</span>
                  <div className="text-red-500 text-xs">🚫 Blocked</div>
                </div>
                <div className="text-center opacity-50">
                  <FaTabletAlt className="text-red-400 text-2xl mx-auto mb-2" />
                  <span className="text-xs text-red-400">Tablet</span>
                  <div className="text-red-500 text-xs">🚫 Blocked</div>
                </div>
                <div className="text-center">
                  <FaMobile className="text-green-400 text-2xl mx-auto mb-2" />
                  <span className="text-xs text-green-400">Mobile</span>
                  <div className="text-green-500 text-xs">✅ Allowed</div>
                </div>
              </div>
              
              <div className="bg-gray-700 rounded-lg p-4 mb-4">
                <h4 className="text-white font-semibold mb-2 flex items-center justify-center">
                  <FaMobile className="mr-2 text-pink-500" />
                  To access Bubblegum:
                </h4>
                <div className="text-sm text-gray-300 space-y-1">
                  <p>1. Use your mobile phone 📱</p>
                  <p>2. Open any mobile browser</p>
                  <p>3. Visit this URL</p>
                  <p>4. Enjoy the full experience! 🎉</p>
                </div>
              </div>
              
              <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4">
                <div className="flex items-center justify-center mb-2">
                  <FaExclamationTriangle className="text-yellow-400 mr-2" />
                  <span className="text-yellow-400 font-semibold text-sm">Important Notice</span>
                </div>
                <p className="text-yellow-200 text-xs leading-relaxed">
                  This restriction ensures optimal performance and user experience. 
                  Bubblegum&apos;s features are specifically designed for mobile touch interactions.
                </p>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-gray-400 text-sm font-medium">
                Please switch to a mobile device to continue
              </p>
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="mt-4"
              >
                <FaMobile className="text-pink-500 text-3xl mx-auto" />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
} 