"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaArrowLeft, FaHeart, FaSignOutAlt, FaQuestionCircle } from "react-icons/fa";
import BottomNavigation from "@/components/BottomNavigation";
import OnboardingModal from "@/components/OnboardingModal";
import { clearPWASession } from "@/lib/pwaUtils";

interface UserData {
  id: string;
  name: string;
  email: string;
  username: string;
  image: string | null;
  bio: string | null;
}

interface VideoData {
  id: string;
  title: string;
  thumbnail: string | null;
  likes: number;
  filePath: string;
  description?: string;
  storageType?: 'cloudinary' | 'local';
}

export default function Profile() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [likedVideos, setLikedVideos] = useState<VideoData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    // Fetch user data from database
    const fetchUserData = async () => {
      setUserLoading(true);
      try {
        const response = await fetch("/api/user/profile");
        if (response.ok) {
          const data = await response.json();
          setUserData(data.user);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setUserLoading(false);
      }
    };

    if (session?.user) {
      fetchUserData();
    }
  }, [session]);

  useEffect(() => {
    // Fetch user's liked videos
    const fetchLikedVideos = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/user/liked-videos");
        if (response.ok) {
          const data = await response.json();
          console.log("Liked videos data:", data.videos);
          setLikedVideos(data.videos || []);
        }
      } catch (error) {
        console.error("Error fetching liked videos:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (session?.user) {
      fetchLikedVideos();
    }
  }, [session]);

  // Function to handle video click
  const handleVideoClick = (videoId: string) => {
    router.push(`/video/${videoId}`);
  };

  // Add signOut handler
  const handleSignOut = () => {
    // Clear PWA session storage on logout
    clearPWASession();
    
    signOut({ callbackUrl: "/login" });
  };

  // Handle onboarding modal
  const handleShowTutorial = () => {
    setShowOnboarding(true);
  };

  const handleOnboardingClose = () => {
    setShowOnboarding(false);
  };

  if (status === "loading" || userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-pink-500"></div>
          <p className="mt-4 text-gray-300">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-900 pb-16 font-chivo">
      {/* Onboarding Modal */}
      <OnboardingModal 
        isOpen={showOnboarding} 
        onClose={handleOnboardingClose} 
      />
      
      {/* Header */}
      <header className="sticky top-0 z-10 bg-black py-3 px-4 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="mr-4 text-white">
              <FaArrowLeft />
            </Link>
            <h1 className="text-xl font-bold text-white font-chivo">Profile</h1>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              className="text-white p-2 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors"
              onClick={handleShowTutorial}
              title="Lihat Tutorial"
            >
              <FaQuestionCircle size={16} />
            </button>
            <button 
              className="text-white px-3 py-1.5 rounded-full bg-red-600 flex items-center space-x-2 hover:bg-red-700 transition-colors font-chivo"
              onClick={handleSignOut}
            >
              <FaSignOutAlt size={16} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Profile Info */}
      <div className="px-4 py-6">
        <div className="flex items-center">
          <div className="h-20 w-20 overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
            {userData?.image ? (
              <img 
                src={userData.image} 
                alt={userData.name} 
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-3xl font-bold text-white">
                {userData?.name?.charAt(0) || "U"}
              </span>
            )}
          </div>
          <div className="ml-4">
            <h2 className="text-xl font-bold text-white">
              {userData?.name || "User"}
            </h2>
            <p className="text-gray-400">@{userData?.username || "username"}</p>
            {userData?.bio && (
              <p className="text-gray-300 text-sm mt-1">{userData.bio}</p>
            )}
          </div>
        </div>

        {/* Edit Profile Button */}
        <div className="mt-6">
          <Link href="/profile/edit" className="block w-full rounded-full bg-gradient-to-r from-pink-500 to-purple-500 py-2 text-center font-medium text-white">
            Edit Profile
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button 
            onClick={handleShowTutorial}
            className="flex items-center justify-center space-x-2 bg-gray-800 hover:bg-gray-700 text-white py-3 px-4 rounded-lg transition-colors"
          >
            <FaQuestionCircle className="text-blue-400" />
            <span className="text-sm font-medium">Tutorial</span>
          </button>
          <div className="flex items-center justify-center space-x-2 bg-gray-800 text-gray-400 py-3 px-4 rounded-lg">
            <FaHeart className="text-pink-400" />
            <span className="text-sm font-medium">{likedVideos.length} Likes</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mt-4">
        <div className="border-b border-gray-800">
          <div className="flex">
            <div className="flex-1 border-b-2 border-pink-500 py-2 text-center text-white">
              Liked Videos
            </div>
          </div>
        </div>

        {/* Liked Videos Grid */}
        <div className="p-1">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-pink-500"></div>
            </div>
          ) : likedVideos.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-center">
              <p className="text-gray-400">No liked videos yet</p>
              <Link href="/" className="mt-4 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-6 py-2 text-white">
                Discover videos
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
              {likedVideos.map((video) => (
                <div 
                  key={video.id} 
                  className="aspect-[9/16] relative overflow-hidden bg-gray-800 cursor-pointer rounded-md"
                  onClick={() => handleVideoClick(video.id)}
                >
                  {video.thumbnail && video.thumbnail.trim() !== '' ? (
                    <>
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          console.error(`[Profile] Failed to load thumbnail: ${video.thumbnail}`);
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      {/* Storage type badge */}
                      <div className="absolute top-1 right-1">
                        <span className={`text-xs px-1 py-0.5 rounded text-white font-bold shadow-sm ${
                          video.storageType === 'cloudinary' ? 'bg-blue-500' : 'bg-gray-500'
                        }`}>
                          {video.storageType === 'cloudinary' ? 'CDN' : 'LOC'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gray-700">
                      <div className="text-center px-2">
                        <div className="text-gray-400 text-lg mb-1">📹</div>
                        <span className="text-gray-400 text-xs text-center">No thumbnail</span>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-xs text-white font-medium truncate">{video.title}</p>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center">
                          <FaHeart className="mr-1 text-xs text-pink-500" />
                          <span className="text-xs text-white">{video.likes}</span>
                        </div>
                        <div className="text-xs text-white/70">
                          Liked
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </main>
  );
} 