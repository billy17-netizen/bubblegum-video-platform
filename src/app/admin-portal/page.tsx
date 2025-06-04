"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Poppins } from "next/font/google";
import { motion, useReducedMotion } from "framer-motion";
import { useClientOnly, preventExtensionInterference } from "@/lib/hydration-utils";

// Define fonts with display swap for better performance
const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-poppins",
  preload: true,
});

export default function AdminPortal() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
        // Non-admin user should not be here
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
        password,
        isAdmin: "true",
        redirect: false,
      });

      if (result?.error) {
        if (result.error.includes("Invalid")) {
          setError("Invalid admin credentials. Please check your username and password.");
        } else {
          setError(result.error);
        }
      } else {
        // Success - redirect to admin dashboard
        router.push("/admin");
      }
    } catch (error) {
      console.error("Admin login error:", error);
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
    <div className={`flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 to-gray-700 p-4 ${poppins.className}`}>
      <motion.div 
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"
        variants={containerVariants}
        initial={isMounted ? "hidden" : false}
        animate={isMounted ? "visible" : false}
        suppressHydrationWarning
      >
        <motion.div variants={itemVariants} suppressHydrationWarning>
          <div className="text-center mb-8">
            <div 
              className="mx-auto w-16 h-16 bg-gradient-to-r from-gray-600 to-gray-800 rounded-full flex items-center justify-center mb-4"
              role="img"
              aria-label="Security lock icon"
            >
              <svg 
                className="w-8 h-8 text-white" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Admin Portal
            </h1>
            <p className="text-gray-600">
              Secure administrator access
            </p>
          </div>
        </motion.div>

        <motion.form onSubmit={handleSubmit} className="space-y-5" variants={itemVariants} noValidate suppressHydrationWarning>
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 mb-1.5 ml-1"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              className={`block w-full rounded-xl border border-gray-200 px-4 py-3 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all duration-200 text-gray-800 ${
                isLoading ? "bg-gray-100 cursor-not-allowed" : ""
              }`}
              required
              placeholder="Enter admin username"
              autoComplete="username"
              suppressHydrationWarning
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1.5 ml-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className={`block w-full rounded-xl border border-gray-200 px-4 py-3 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all duration-200 text-gray-800 ${
                isLoading ? "bg-gray-100 cursor-not-allowed" : ""
              }`}
              required
              placeholder="Enter admin password"
              autoComplete="current-password"
              suppressHydrationWarning
            />
          </div>

          {error && (
            <motion.div 
              className="rounded-xl bg-red-50 border border-red-200 p-3"
              initial={shouldReduceMotion || !isMounted ? false : { opacity: 0, y: -10 }}
              animate={shouldReduceMotion || !isMounted ? false : { opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              role="alert"
              aria-live="polite"
              suppressHydrationWarning
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg 
                    className="h-5 w-5 text-red-400" 
                    viewBox="0 0 20 20" 
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-700">
                    {error}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          <motion.button
            type="submit"
            disabled={isLoading}
            className={`w-full rounded-xl py-3 text-white font-medium shadow-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all duration-200 mt-6 ${
              isLoading 
                ? "bg-gray-400 cursor-not-allowed" 
                : "bg-gradient-to-r from-gray-600 to-gray-800 hover:shadow-lg hover:from-gray-700 hover:to-gray-900"
            }`}
            whileHover={!isLoading && !shouldReduceMotion && isMounted ? { scale: 1.01 } : undefined}
            whileTap={!isLoading && !shouldReduceMotion && isMounted ? { scale: 0.99 } : undefined}
            aria-describedby={error ? "error-message" : undefined}
            suppressHydrationWarning
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <svg 
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
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
                <span className="sr-only">Authenticating, please wait</span>
                Authenticating...
              </div>
            ) : (
              "Access Admin Dashboard"
            )}
          </motion.button>
        </motion.form>

        <motion.div 
          className="mt-6 text-center"
          variants={itemVariants}
          suppressHydrationWarning
        >
          <p className="text-xs text-gray-500">
            This portal is restricted to authorized administrators only.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
} 