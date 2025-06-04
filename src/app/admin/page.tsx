"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { 
  FaVideo, 
  FaEye, 
  FaHeart, 
  FaUserPlus, 
  FaClock
} from "react-icons/fa";
import AdminLayout from "@/components/AdminLayout";

// Existing interfaces for data
interface AuthCode {
  code: string;
  expiresAt: string;
}

interface VideoStats {
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
}

interface RecentVideo {
  id: string;
  title: string;
  description: string | null;
  views: number;
  thumbnail: string | null;
  timeAgo: string;
}

interface User {
  id: string;
  username: string;
  createdAt: string;
  authCode: {
    code: string;
    expiresAt: string | null;
    createdAt: string;
  };
}

export default function AdminDashboard() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [authCode, setAuthCode] = useState<AuthCode | null>(null);
  const [error, setError] = useState("");
  const [videoStats, setVideoStats] = useState<VideoStats>({
    totalVideos: 0,
    totalViews: 0,
    totalLikes: 0
  });
  const [recentVideos, setRecentVideos] = useState<RecentVideo[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch dashboard stats
      const statsResponse = await fetch("/api/admin/dashboard-stats");
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setVideoStats(statsData.stats);
      }

      // Fetch recent videos
      const videosResponse = await fetch("/api/admin/recent-uploads");
      if (videosResponse.ok) {
        const videosData = await videosResponse.json();
        setRecentVideos(videosData.videos);
      }
      
      // Fetch users data
      const usersResponse = await fetch("/api/admin/users");
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData.users);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
  };

  const generateAuthCode = async () => {
    setIsGenerating(true);
    setError("");

    try {
      const response = await fetch("/api/admin/generate-code", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to generate auth code");
      }

      const data = await response.json();
      setAuthCode({
        code: data.code,
        expiresAt: data.expiresAt,
      });
    } catch (error) {
      console.error("Error generating auth code:", error);
      setError("Failed to generate auth code");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (authCode) {
      const expiredDate = new Date(authCode.expiresAt).toLocaleString('id-ID', {
        year: 'numeric',
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta'
      });
      
      const textToCopy = `Code Auth: ${authCode.code}\nExpired: ${expiredDate}`;
      navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleAdvancedEdit = (videoId: string) => {
    router.push(`/admin/edit/${videoId}`);
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/videos/${videoId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete video');
      }
      
      // Refresh the data after successful delete
      fetchDashboardData();
    } catch (error) {
      console.error("Error deleting video:", error);
    }
  };

  // Animation variants
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  return (
    <AdminLayout title="Dashboard">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 font-chivo">Welcome to Bubblegum Admin</h2>
        <p className="text-gray-600 font-chivo">
          Welcome to your admin dashboard! Here&apos;s an overview of your platform&apos;s performance.
        </p>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <motion.div 
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
          variants={itemVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="flex items-center">
            <div className="p-3 rounded-xl bg-blue-100">
              <FaVideo className="text-blue-600 text-xl" />
            </div>
            <div className="ml-4">
              <h3 className="text-gray-500 text-sm">Total Videos</h3>
              <p className="text-2xl font-bold text-gray-900">{videoStats.totalVideos}</p>
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center">
            <div className="p-3 rounded-xl bg-green-100">
              <FaEye className="text-green-600 text-xl" />
            </div>
            <div className="ml-4">
              <h3 className="text-gray-500 text-sm">Total Views</h3>
              <p className="text-2xl font-bold text-gray-900">{videoStats.totalViews}</p>
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center">
            <div className="p-3 rounded-xl bg-pink-100">
              <FaHeart className="text-pink-600 text-xl" />
            </div>
            <div className="ml-4">
              <h3 className="text-gray-500 text-sm">Total Likes</h3>
              <p className="text-2xl font-bold text-gray-900">{videoStats.totalLikes}</p>
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center">
            <div className="p-3 rounded-xl bg-purple-100">
              <FaUserPlus className="text-purple-600 text-xl" />
            </div>
            <div className="ml-4">
              <h3 className="text-gray-500 text-sm">Total Users</h3>
              <p className="text-2xl font-bold text-gray-900">{users.length}</p>
            </div>
          </div>
        </motion.div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Videos */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">Recent Videos</h2>
            <button 
              onClick={() => router.push("/admin/videos")}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View all
            </button>
          </div>
          
          <div className="overflow-y-auto max-h-[400px]">
            {recentVideos.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {recentVideos.map((video) => (
                  <div key={video.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start">
                      <div className="h-16 w-24 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                        {video.thumbnail && video.thumbnail.trim() !== '' && !video.thumbnail.includes('admin/videos') ? (
                          <Image 
                            src={video.thumbnail.startsWith('/') || video.thumbnail.startsWith('http') ? video.thumbnail : `/${video.thumbnail}`} 
                            alt={video.title || 'Video thumbnail'}
                            width={96}
                            height={64}
                            className="object-cover w-full h-full"
                            onError={(e) => {
                              console.error('[Admin Dashboard] Image load error:', video.thumbnail);
                              // Replace with placeholder
                              e.currentTarget.style.display = 'none';
                            }}
                            unoptimized={true}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-r from-gray-300 to-gray-200 flex items-center justify-center">
                            <FaVideo className="text-gray-400 text-xl" />
                          </div>
                        )}
                      </div>
                      <div className="ml-4 flex-1">
                        <h3 className="font-medium text-gray-900 mb-1">{video.title}</h3>
                        <div className="flex items-center text-xs text-gray-500">
                          <FaEye className="mr-1" /> <span className="mr-3">{video.views} views</span>
                          <FaClock className="mr-1" /> <span>{video.timeAgo}</span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleAdvancedEdit(video.id)}
                          className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                          title="Edit"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteVideo(video.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500">
                No videos uploaded yet.
              </div>
            )}
          </div>
        </div>

        {/* Auth Code Generator */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Auth Code Generator</h2>
          </div>
          
          <div className="p-6 flex-1">
            <p className="text-gray-600 text-sm mb-4">
              Generate a new authentication code for users to sign up with.
            </p>
            
            <button
              onClick={generateAuthCode}
              disabled={isGenerating}
              className="w-full py-2 px-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-medium rounded-lg hover:from-pink-600 hover:to-purple-600 transition-colors disabled:opacity-70"
            >
              {isGenerating ? "Generating..." : "Generate New Code"}
            </button>
            
            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-500 text-sm rounded-lg">
                {error}
              </div>
            )}
            
            {authCode && (
              <div className="mt-4 p-4 border border-blue-100 rounded-lg bg-blue-50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-blue-700">Auth Code:</span>
                  <button
                    onClick={copyToClipboard}
                    className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 py-1 px-2 rounded"
                  >
                    {isCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="bg-white border border-blue-100 rounded p-2 text-center font-mono text-blue-800 font-medium">
                  {authCode.code}
                </div>
                <p className="mt-2 text-xs text-blue-700">
                  Expires: {new Date(authCode.expiresAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>
          
          <div className="px-6 py-4 bg-gray-50 rounded-b-xl border-t border-gray-100">
            <button
              onClick={() => router.push("/admin/auth-codes")}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Manage Auth Codes
            </button>
          </div>
        </div>
      </div>
      
      {/* Recent Users */}
      <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800">Recent Users</h2>
          <button 
            onClick={() => router.push("/admin/users")}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View all users
          </button>
        </div>
        
        <div className="overflow-x-auto">
          {users.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Username
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Auth Code
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registered On
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.slice(0, 5).map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.username}</div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {user.authCode.code}
                      </div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 text-center text-gray-500">
              No users have registered yet.
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
} 