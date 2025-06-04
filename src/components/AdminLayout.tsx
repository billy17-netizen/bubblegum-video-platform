"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AdminSidebar from "./AdminSidebar";
import { FaBars } from "react-icons/fa";
import { motion } from "framer-motion";

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.push("/");
    } else if (status === "authenticated") {
      setIsLoading(false);
    }
  }, [status, session, router]);
  
  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  
  if (status === "loading" || isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    );
  }
  
  return (
    <div className={`min-h-screen bg-gray-50 flex font-chivo`}>
      {/* Sidebar - Hidden on mobile, always visible on desktop */}
      <div className="hidden md:block h-screen sticky top-0">
        <AdminSidebar isMobile={false} />
      </div>
      
      {/* Mobile sidebar */}
      {isSidebarOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-30"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className="md:hidden">
            <AdminSidebar isMobile={true} toggleSidebar={toggleSidebar} />
          </div>
        </>
      )}
      
      {/* Main content */}
      <div className="flex-1">
        {/* Top navigation bar */}
        <div className="bg-white shadow-sm h-16 sticky top-0 z-20">
          <div className="h-full px-4 flex items-center justify-between">
            <div className="flex items-center">
              <button 
                className="md:hidden mr-4 text-gray-600 hover:text-gray-900"
                onClick={toggleSidebar}
              >
                <FaBars size={20} />
              </button>
              {title && (
                <h1 className="text-xl font-semibold text-gray-800 font-chivo">{title}</h1>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <button className="text-gray-400 hover:text-gray-600 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-pink-500 ring-2 ring-white"></span>
                </button>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                {session?.user?.name?.[0] || "A"}
              </div>
            </div>
          </div>
        </div>
        
        {/* Page content */}
        <motion.div 
          className="p-4 md:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
} 