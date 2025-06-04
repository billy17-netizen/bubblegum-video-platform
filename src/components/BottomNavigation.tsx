"use client";

import { useRouter, usePathname } from "next/navigation";
import { FaHome, FaCompass, FaUser } from "react-icons/fa";
import { motion } from "framer-motion";

export default function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  const navigateToHome = () => {
    if (pathname === "/") {
      // Already on home page - just trigger shuffle without scrolling
      console.log('[Navigation] On home page, triggering shuffle without scroll');
      window.dispatchEvent(new CustomEvent('shuffleVideos'));
    } else {
      // Navigate to home page from other pages
      router.push("/");
    }
  };

  const navigateToExplore = () => {
    // Emit event to stop all videos before navigating
    window.dispatchEvent(new CustomEvent('stopAllVideos'));
    router.push("/explore");
  };

  const navigateToProfile = () => {
    // Emit event to stop all videos before navigating
    window.dispatchEvent(new CustomEvent('stopAllVideos'));
    router.push("/profile");
  };

  const isHome = pathname === "/";
  const isExplore = pathname === "/explore";
  const isProfile = pathname === "/profile";

  return (
    <motion.nav
      className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-md border-t border-gray-800 z-40"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="flex items-center justify-around py-1 max-w-md mx-auto">
        {/* Home */}
        <motion.button
          onClick={navigateToHome}
          className={`flex flex-col items-center justify-center p-1.5 ${
            isHome ? 'text-white' : 'text-gray-500'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title={isHome ? "Shuffle videos" : "Go to home"}
        >
          <div className="relative">
            <FaHome size={18} />
            {isHome && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-pink-500 rounded-full"
              />
            )}
          </div>
          <span className={`text-[10px] mt-0.5 font-chivo ${
            isHome ? 'text-white' : 'text-gray-500'
          }`}>
            {isHome ? 'Shuffle' : 'Home'}
          </span>
        </motion.button>

        {/* Explore */}
        <motion.button
          onClick={navigateToExplore}
          className={`flex flex-col items-center justify-center p-1.5 ${
            isExplore ? 'text-white' : 'text-gray-500'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="relative">
            <FaCompass size={18} />
            {isExplore && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-pink-500 rounded-full"
              />
            )}
          </div>
          <span className={`text-[10px] mt-0.5 font-chivo ${
            isExplore ? 'text-white' : 'text-gray-500'
          }`}>
            Explore
          </span>
        </motion.button>

        {/* Profile */}
        <motion.button
          onClick={navigateToProfile}
          className={`flex flex-col items-center justify-center p-1.5 ${
            isProfile ? 'text-white' : 'text-gray-500'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="relative">
            <FaUser size={18} />
            {isProfile && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-pink-500 rounded-full"
              />
            )}
          </div>
          <span className={`text-[10px] mt-0.5 font-chivo ${
            isProfile ? 'text-white' : 'text-gray-500'
          }`}>
            Profile
          </span>
        </motion.button>
      </div>
    </motion.nav>
  );
} 