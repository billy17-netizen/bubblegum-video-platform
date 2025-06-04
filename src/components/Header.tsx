"use client";

import React, { useState } from 'react';
import { FaHome, FaUser, FaSignInAlt, FaSignOutAlt, FaBars, FaList, FaGripHorizontal } from 'react-icons/fa';
import { motion } from 'framer-motion';
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { clearPWASession } from "@/lib/pwaUtils";
import { useRouter } from 'next/navigation';

interface HeaderProps {
  onLayoutChange: (layout: 'grid' | 'column') => void;
}

const Header = ({ onLayoutChange }: HeaderProps) => {
  const [isGridView, setIsGridView] = useState(false);
  
  const toggleLayout = () => {
    const newIsGridView = !isGridView;
    setIsGridView(newIsGridView);
    onLayoutChange(newIsGridView ? 'grid' : 'column');
  };
  
  const handleSignOut = () => {
    // Clear PWA session storage on logout
    clearPWASession();
    
    signOut({ callbackUrl: "/login" });
  };
  
  const buttonVariants = {
    initial: { scale: 1 },
    tap: { scale: 0.9 },
    hover: { scale: 1.1, color: '#ec4899' }
  };
  
  return (
    <motion.div 
      className="fixed top-0 left-0 right-0 z-50 bg-black/70 backdrop-blur-md border-b border-gray-800"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="flex items-center justify-between px-4 py-3 max-w-md mx-auto">
        {/* Logo */}
        <motion.div 
          className="text-pink-500 font-bold text-xl flex items-center"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <span className="bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
            Bubblegum
          </span>
        </motion.div>
        
        {/* Actions */}
        <div className="flex space-x-5">
          {/* View Toggle */}
          <motion.button 
            onClick={toggleLayout} 
            className="text-white transition-colors"
            variants={buttonVariants}
            initial="initial"
            whileHover="hover"
            whileTap="tap"
            animate={isGridView ? { color: '#ec4899' } : { color: '#ffffff' }}
          >
            {isGridView ? <FaList size={18} /> : <FaGripHorizontal size={18} />}
          </motion.button>
          
          {/* Logout */}
          <motion.button 
            onClick={handleSignOut}
            className="text-white transition-colors"
            variants={buttonVariants}
            initial="initial"
            whileHover="hover"
            whileTap="tap"
          >
            <FaSignOutAlt size={18} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default Header; 