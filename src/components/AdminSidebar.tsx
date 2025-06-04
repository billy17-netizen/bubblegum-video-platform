"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from "framer-motion";
import { 
  FaHome, 
  FaVideo, 
  FaUsers, 
  FaUpload,
  FaCog, 
  FaKey,
  FaTimes,
  FaSignOutAlt,
  FaPlus
} from 'react-icons/fa';
import { signOut } from "next-auth/react";
import { clearPWASession } from "@/lib/pwaUtils";

interface SidebarProps {
  isMobile: boolean;
  toggleSidebar?: () => void;
}

export default function AdminSidebar({ isMobile, toggleSidebar }: SidebarProps) {
  const pathname = usePathname();
  
  const menuItems = [
    { icon: <FaHome />, text: "Dashboard", href: "/admin" },
    { icon: <FaVideo />, text: "Manage Videos", href: "/admin/videos" },
    { icon: <FaPlus />, text: "Upload Video", href: "/admin/upload" },
    { icon: <FaUpload />, text: "Bulk Upload", href: "/admin/bulk-upload" },
    { icon: <FaUsers />, text: "User Management", href: "/admin/users" },
    { icon: <FaKey />, text: "Auth Codes", href: "/admin/auth-codes" },
    { icon: <FaCog />, text: "Settings", href: "/admin/settings" },
  ];

  const handleSignOut = () => {
    // Clear PWA session storage on logout
    clearPWASession();
    
    signOut({ callbackUrl: "/login" });
  };

  return (
    <motion.div
      className={`bg-gray-900 text-white h-full flex flex-col ${isMobile ? "absolute z-40 w-64" : "w-64"}`}
      initial={isMobile ? { x: -250 } : { x: 0 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
            <span className="text-lg font-bold">B</span>
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
            Bubblegum
          </h1>
        </div>
        {isMobile && (
          <button 
            onClick={toggleSidebar}
            className="text-gray-300 hover:text-white focus:outline-none"
          >
            <FaTimes />
          </button>
        )}
      </div>
      
      <div className="mt-6 px-4">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Main Menu</span>
      </div>

      <nav className="mt-2 flex-1 overflow-y-auto">
        <ul className="px-2">
          {menuItems.map((item, index) => {
            const isActive = pathname === item.href;
            
            return (
              <li key={index} className="mb-1">
                <Link href={item.href}>
                  <div
                    className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 relative ${
                      isActive
                        ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                  >
                    <span className="text-lg mr-3">{item.icon}</span>
                    <span className="font-medium">{item.text}</span>
                    
                    {isActive && (
                      <motion.div
                        layoutId="active-pill"
                        className="ml-auto h-2 w-2 rounded-full bg-white"
                      />
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-700">
        <button
          onClick={handleSignOut}
          className="flex items-center px-4 py-2 w-full rounded-xl text-gray-300 hover:bg-gray-700 hover:text-white transition-all duration-200"
        >
          <FaSignOutAlt className="mr-3" />
          <span>Sign Out</span>
        </button>
      </div>
    </motion.div>
  );
} 