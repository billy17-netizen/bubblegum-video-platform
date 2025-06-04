"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FaPlus, 
  FaCopy, 
  FaTrash, 
  FaClock, 
  FaCheck, 
  FaTimes,
  FaUser,
  FaEdit
} from "react-icons/fa";
import AdminLayout from "@/components/AdminLayout";

interface AuthCode {
  id: string;
  code: string;
  expiresAt: string | null;
  createdAt: string;
  usedBy: {
    id: string;
    username: string;
  } | null;
  isExpired: boolean;
  isUsed: boolean;
}

export default function AuthCodesPage() {
  const [codes, setCodes] = useState<AuthCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState("");
  const [editingCode, setEditingCode] = useState<AuthCode | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editExpiryDate, setEditExpiryDate] = useState("");
  const [isUnlimited, setIsUnlimited] = useState(false);

  useEffect(() => {
    fetchAuthCodes();
  }, []);

  const fetchAuthCodes = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/auth-codes");
      if (response.ok) {
        const data = await response.json();
        setCodes(data.authCodes);
      } else {
        setError("Failed to fetch auth codes");
      }
    } catch (error) {
      console.error("Error fetching auth codes:", error);
      setError("Failed to fetch auth codes");
    } finally {
      setLoading(false);
    }
  };

  const generateAuthCode = async () => {
    setGenerating(true);
    setError("");

    try {
      const response = await fetch("/api/admin/generate-code", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to generate auth code");
      }

      // Refresh the list after generating new code
      fetchAuthCodes();
    } catch (error) {
      console.error("Error generating auth code:", error);
      setError("Failed to generate auth code");
    } finally {
      setGenerating(false);
    }
  };

  const deleteAuthCode = async (codeId: string) => {
    if (!confirm("Are you sure you want to delete this auth code?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/auth-codes/${codeId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchAuthCodes(); // Refresh the list
      } else {
        setError("Failed to delete auth code");
      }
    } catch (error) {
      console.error("Error deleting auth code:", error);
      setError("Failed to delete auth code");
    }
  };

  const openEditModal = (authCode: AuthCode) => {
    setEditingCode(authCode);
    // Format the date for datetime-local input
    if (authCode.expiresAt) {
      const date = new Date(authCode.expiresAt);
      // Convert to local time and format for datetime-local input
      const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      setEditExpiryDate(localDate.toISOString().slice(0, 16));
      setIsUnlimited(false);
    } else {
      setEditExpiryDate("");
      setIsUnlimited(true);
    }
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingCode(null);
    setEditExpiryDate("");
    setIsUnlimited(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCode) return;

    try {
      const response = await fetch(`/api/admin/auth-codes/${editingCode.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expiresAt: isUnlimited ? null : (editExpiryDate || null),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const updatedCode = result.authCode;
        
        // Update the state with proper data structure
        setCodes(prevCodes => 
          prevCodes.map(code => {
            if (code.id === editingCode.id) {
              return {
                id: code.id,
                code: code.code,
                expiresAt: updatedCode.expiresAt,
                createdAt: code.createdAt,
                usedBy: updatedCode.usedBy || code.usedBy,
                isExpired: updatedCode.isExpired,
                isUsed: code.isUsed,
              };
            }
            return code;
          })
        );
        closeEditModal();
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to update auth code");
      }
    } catch (error) {
      console.error("Error updating auth code:", error);
      alert("Failed to update auth code");
    }
  };

  // Helper function to format date with time in user's timezone
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "Never";
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Jakarta',
      timeZoneName: 'short'
    }).format(date);
  };

  const copyToClipboard = (authCode: AuthCode) => {
    const expiredDate = formatDateTime(authCode.expiresAt);
    const textToCopy = `Code Auth: ${authCode.code}\nExpired: ${expiredDate}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedCode(authCode.code);
    setTimeout(() => setCopiedCode(""), 2000);
  };

  const getStatusBadge = (authCode: AuthCode) => {
    if (authCode.isUsed) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <FaCheck className="mr-1" />
          Used
        </span>
      );
    } else if (authCode.isExpired) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <FaTimes className="mr-1" />
          Expired
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <FaClock className="mr-1" />
          Active
        </span>
      );
    }
  };

  const activeCodesCount = codes.filter(code => !code.isUsed && !code.isExpired).length;
  const usedCodesCount = codes.filter(code => code.isUsed).length;
  const expiredCodesCount = codes.filter(code => code.isExpired && !code.isUsed).length;

  return (
    <AdminLayout title="Auth Codes">
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">Authentication Codes</h2>
            <p className="text-gray-500">Manage authentication codes for user registration.</p>
            <p className="text-sm text-gray-400 mt-1">
              Users can login multiple times with the same auth code. Codes only become unusable when expired.
            </p>
          </div>
          <button
            onClick={generateAuthCode}
            disabled={generating}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-medium rounded-lg hover:from-pink-600 hover:to-purple-600 transition-colors disabled:opacity-70"
          >
            <FaPlus className="mr-2" />
            {generating ? "Generating..." : "Generate New Code"}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-xl bg-blue-100">
              <FaClock className="text-blue-600 text-xl" />
            </div>
            <div className="ml-4">
              <h3 className="text-gray-500 text-sm">Active Codes</h3>
              <p className="text-2xl font-bold text-gray-900">{activeCodesCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-xl bg-green-100">
              <FaCheck className="text-green-600 text-xl" />
            </div>
            <div className="ml-4">
              <h3 className="text-gray-500 text-sm">Used Codes</h3>
              <p className="text-2xl font-bold text-gray-900">{usedCodesCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-xl bg-red-100">
              <FaTimes className="text-red-600 text-xl" />
            </div>
            <div className="ml-4">
              <h3 className="text-gray-500 text-sm">Expired Codes</h3>
              <p className="text-2xl font-bold text-gray-900">{expiredCodesCount}</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-500 rounded-lg">
          {error}
        </div>
      )}

      {/* Auth Codes Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">All Authentication Codes</h3>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
            <p className="mt-2 text-gray-500">Loading auth codes...</p>
          </div>
        ) : codes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No authentication codes found.</p>
            <button
              onClick={generateAuthCode}
              className="mt-4 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg hover:from-pink-600 hover:to-purple-600 transition-colors"
            >
              Generate Your First Code
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Used By
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expires
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {codes.map((authCode) => (
                  <motion.tr
                    key={authCode.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="font-mono text-sm font-medium text-gray-900">
                          {authCode.code}
                        </span>
                        <button
                          onClick={() => copyToClipboard(authCode)}
                          className="ml-2 p-1 text-gray-400 hover:text-blue-500 transition-colors"
                          title="Copy code"
                        >
                          <FaCopy size={12} />
                        </button>
                        {copiedCode === authCode.code && (
                          <span className="ml-2 text-xs text-green-600">Copied!</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(authCode)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {authCode.usedBy ? (
                        <div className="flex items-center">
                          <FaUser className="mr-1 text-gray-400" size={12} />
                          <span className="text-sm text-gray-900">{authCode.usedBy.username}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(authCode.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(authCode.expiresAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditModal(authCode)}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                          title="Edit expiry date"
                        >
                          <FaEdit size={14} />
                        </button>
                        <button
                          onClick={() => deleteAuthCode(authCode.id)}
                          className="text-red-600 hover:text-red-900 transition-colors"
                          title="Delete code"
                        >
                          <FaTrash size={14} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingCode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsEditModalOpen(false);
                setEditingCode(null);
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
            >
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Edit Auth Code
                {editingCode.isUsed && (
                  <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <FaCheck className="mr-1" size={10} />
                    Used
                  </span>
                )}
              </h3>
              <form onSubmit={handleEdit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Code
                  </label>
                  <input
                    type="text"
                    value={editingCode.code}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
                  />
                  {editingCode.usedBy && (
                    <p className="text-xs text-gray-500 mt-1">
                      Used by: <span className="font-medium">{editingCode.usedBy.username}</span>
                    </p>
                  )}
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Expiration Settings
                  </label>
                  
                  {/* Radio buttons for unlimited/limited */}
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="unlimited"
                        name="expirationType"
                        checked={isUnlimited}
                        onChange={() => {
                          setIsUnlimited(true);
                          setEditExpiryDate("");
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label htmlFor="unlimited" className="ml-2 text-sm text-gray-700">
                        Unlimited (Never expires)
                      </label>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="limited"
                        name="expirationType"
                        checked={!isUnlimited}
                        onChange={() => setIsUnlimited(false)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label htmlFor="limited" className="ml-2 text-sm text-gray-700">
                        Set expiration date
                      </label>
                    </div>
                  </div>
                  
                  {/* Date input - only show when not unlimited */}
                  {!isUnlimited && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expires At
                      </label>
                      <input
                        type="datetime-local"
                        value={editExpiryDate}
                        onChange={(e) => setEditExpiryDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                        min={new Date().toISOString().slice(0, 16)}
                      />
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-3">
                    {editingCode.isUsed 
                      ? "Used codes can still be used by the same user for login. Only expiry prevents access."
                      : isUnlimited
                        ? "This code will never expire and can be used indefinitely"
                        : "Set a future date and time when this code should expire"
                    }
                  </p>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
} 