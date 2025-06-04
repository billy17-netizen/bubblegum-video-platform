"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaArrowLeft, FaCamera, FaSpinner } from "react-icons/fa";
import Image from "next/image";

export default function EditProfile() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if user is logged in
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (status !== "authenticated") return;

      try {
        const response = await fetch("/api/user/profile");
        if (response.ok) {
          const data = await response.json();
          setUsername(data.user.username || "");
          setBio(data.user.bio || "");
          setProfileImage(data.user.image);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        setMessage({
          type: "error",
          text: "Failed to load profile information."
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [status]);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({
        type: "error",
        text: "Image file is too large. Maximum size is 5MB."
      });
      return;
    }

    // Save the file for later upload
    setImageFile(file);

    // Preview the selected image
    const reader = new FileReader();
    reader.onload = (event) => {
      setProfileImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadProfileImage = async (file: File): Promise<string | null> => {
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/user/profile/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload image");
      }

      const data = await response.json();
      console.log("Image uploaded successfully:", data);
      return data.user.image;
    } catch (error) {
      console.error("Error uploading image:", error);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to upload image. Please try again."
      });
      return null;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: "", text: "" });

    try {
      // First, upload the image if there's a new one
      let imagePath = null;
      if (imageFile) {
        imagePath = await uploadProfileImage(imageFile);
        if (!imagePath) {
          setMessage({
            type: "error",
            text: "Failed to upload profile image. Please try again."
          });
          setIsSaving(false);
          return;
        }
      }

      // Now update the profile with text fields
      console.log("Sending profile update request...");
      
      const requestData = {
        username,
        bio,
      };
      
      const response = await fetch("/api/user/profile/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error("Server error response:", responseData);
        throw new Error(responseData.error || "Failed to update profile");
      }

      console.log("Profile updated successfully:", responseData);

      // Update the session with new data
      await update({
        ...session,
        user: {
          ...session?.user,
          username,
        },
      });

      setMessage({
        type: "success",
        text: "Profile updated successfully!"
      });

      // Redirect back to profile page after a short delay
      setTimeout(() => {
        router.push("/profile");
      }, 1500);
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to update profile. Please try again."
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (status === "loading" || isLoading) {
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
    <main className="min-h-screen bg-gray-900 pb-16">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-black py-3 px-4 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/profile" className="mr-4 text-white">
              <FaArrowLeft />
            </Link>
            <h1 className="text-xl font-bold text-white">Edit Profile</h1>
          </div>
        </div>
      </header>

      <div className="px-4 py-6">
        <form onSubmit={handleSubmit}>
          {/* Profile Image */}
          <div className="flex flex-col items-center mb-8">
            <div 
              className="relative h-24 w-24 cursor-pointer overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-purple-500"
              onClick={handleImageClick}
            >
              {profileImage ? (
                <img 
                  src={profileImage} 
                  alt={username} 
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="text-3xl font-bold text-white">
                    {username?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 opacity-0 hover:opacity-100 transition-opacity">
                <FaCamera className="text-white text-xl" />
              </div>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageChange}
            />
            <p className="mt-2 text-sm text-gray-400">Tap to change profile photo</p>
          </div>

          {/* Username */}
          <div className="mb-4">
            <label htmlFor="username" className="block mb-2 text-sm font-medium text-gray-300">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2.5 text-white"
              required
            />
          </div>

          {/* Bio */}
          <div className="mb-6">
            <label htmlFor="bio" className="block mb-2 text-sm font-medium text-gray-300">
              Bio
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2.5 text-white"
            />
          </div>

          {/* Status message */}
          {message.text && (
            <div className={`mb-4 p-3 rounded-lg ${message.type === 'error' ? 'bg-red-900/50 text-red-200' : 'bg-green-900/50 text-green-200'}`}>
              {message.text}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-full bg-gradient-to-r from-pink-500 to-purple-500 py-2.5 font-medium text-white disabled:opacity-70"
          >
            {isSaving ? (
              <span className="flex items-center justify-center">
                <FaSpinner className="animate-spin mr-2" />
                Saving...
              </span>
            ) : (
              "Save Changes"
            )}
          </button>
        </form>
      </div>
    </main>
  );
} 