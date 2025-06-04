"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useClientOnly, preventExtensionInterference } from "@/lib/hydration-utils";

export default function Login() {
  const [username, setUsername] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();
  const shouldReduceMotion = useReducedMotion();
  const isMounted = useClientOnly();

  // Prevent browser extension interference
  useEffect(() => {
    preventExtensionInterference();
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (session?.user) {
      if (session.user.role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/");
      }
    }
  }, [session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        username,
        code: authCode,
        isAdmin: "false",
        redirect: false,
      });

      if (result?.error) {
        // Handle specific error types
        if (result.error.includes("expired")) {
          setError("Your authentication code has expired. Please contact admin for a new code.");
        } else if (result.error.includes("already registered")) {
          setError("This authentication code is already registered to another user.");
        } else if (result.error.includes("different auth code")) {
          setError("This username is registered with a different authentication code.");
        } else if (result.error.includes("Invalid")) {
          setError("Invalid credentials. Please check your username and authentication code.");
        } else {
        setError(result.error);
        }
      } else {
        // Success - redirect to home
            router.push("/");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("An unexpected error occurred during login. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Animation variants (only applied after client mount)
  const containerVariants = (shouldReduceMotion || !isMounted) ? undefined : {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.3 }
    }
  };

  const itemVariants = (shouldReduceMotion || !isMounted) ? undefined : {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.2 }
    }
  };

  return (
    <div className={`flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-500 to-purple-600 p-4`}>
      <motion.div 
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"
        variants={containerVariants}
        initial={isMounted ? "hidden" : false}
        animate={isMounted ? "visible" : false}
        suppressHydrationWarning
      >
        <motion.div variants={itemVariants} suppressHydrationWarning>
          <h1 className="mb-2 text-center text-4xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent font-tinos">
            Bubblegum
          </h1>
          <h2 className="mb-8 text-center text-lg font-light text-gray-600 font-chivo">
            Welcome! Join our community
          </h2>
        </motion.div>

        <motion.form onSubmit={handleSubmit} className="space-y-5" variants={itemVariants} suppressHydrationWarning>
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 mb-1.5 ml-1 font-chivo"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              className={`block w-full rounded-xl border border-gray-200 px-4 py-3 shadow-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-200 transition-all duration-200 text-gray-800 font-chivo ${
                isLoading ? "bg-gray-100 cursor-not-allowed" : ""
              }`}
              required
              placeholder="Enter your username"
              suppressHydrationWarning
            />
            <p className="text-xs text-gray-500 mt-1 ml-1 font-chivo">
              Choose any username for your account
            </p>
          </div>

            <div>
              <label
                htmlFor="authCode"
                className="block text-sm font-medium text-gray-700 mb-1.5 ml-1 font-chivo"
              >
                Auth Code
              </label>
              <input
                id="authCode"
                type="text"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
              disabled={isLoading}
              className={`block w-full rounded-xl border border-gray-200 px-4 py-3 shadow-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-200 transition-all duration-200 text-gray-800 font-chivo ${
                isLoading ? "bg-gray-100 cursor-not-allowed" : ""
              }`}
              required
                placeholder="Enter the code provided by admin"
                suppressHydrationWarning
              />
            <p className="text-xs text-gray-500 mt-1 ml-1 font-chivo">
              Use the authentication code given to you by the admin
            </p>
            </div>

          {error && (
            <motion.div 
              className={`rounded-xl p-3 border ${
                error.includes("expired") 
                  ? "bg-red-50 border-red-200" 
                  : error.includes("already registered") || error.includes("different auth code")
                  ? "bg-orange-50 border-orange-200"
                  : "bg-red-50 border-red-200"
              }`}
              initial={shouldReduceMotion || !isMounted ? false : { opacity: 0, y: -10 }}
              animate={shouldReduceMotion || !isMounted ? false : { opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              suppressHydrationWarning
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {error.includes("expired") ? (
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  ) : error.includes("already registered") || error.includes("different auth code") ? (
                    <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${
                    error.includes("expired") 
                      ? "text-red-700" 
                      : error.includes("already registered") || error.includes("different auth code")
                      ? "text-orange-700"
                      : "text-red-700"
                  }`}>
                    {error}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          <motion.button
            type="submit"
            disabled={isLoading}
            className={`w-full rounded-xl py-3 text-white font-medium shadow-md focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2 transition-all duration-300 mt-6 ${
              isLoading 
                ? "bg-gray-400 cursor-not-allowed" 
                : "bg-gradient-to-r from-pink-500 to-purple-500 hover:shadow-lg hover:from-pink-600 hover:to-purple-600"
            }`}
            whileHover={!isLoading && !shouldReduceMotion && isMounted ? { scale: 1.02 } : undefined}
            whileTap={!isLoading && !shouldReduceMotion && isMounted ? { scale: 0.98 } : undefined}
            suppressHydrationWarning
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <svg 
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24"
                >
                  <circle 
                    className="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    strokeWidth="4"
                  ></circle>
                  <path 
                    className="opacity-75" 
                    fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Signing in...
              </div>
            ) : (
              "Enter"
            )}
          </motion.button>
        </motion.form>
      </motion.div>
    </div>
  );
} 