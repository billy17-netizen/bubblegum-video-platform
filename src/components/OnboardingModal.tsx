"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FaHeart, 
  FaHandPaper, 
  FaVolumeUp, 
  FaUser, 
  FaSearch, 
  FaForward, 
  FaBackward,
  FaTimes,
  FaChevronLeft,
  FaChevronRight
} from "react-icons/fa";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OnboardingModal = ({ isOpen, onClose }: OnboardingModalProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const onboardingSteps = [
    {
      title: "Selamat Datang di Bubblegum! 🎉",
      description: "Platform video viral yang akan menghibur Anda! Mari kenali fitur-fitur menarik yang tersedia.",
      icon: "🍭",
      features: []
    },
    {
      title: "Navigasi Video",
      description: "Geser ke atas/bawah untuk berpindah video, seperti TikTok!",
      icon: <FaHandPaper className="text-4xl text-pink-500" />,
      features: [
        "Scroll vertikal untuk video berikutnya",
        "Auto-play saat video terlihat",
        "Video loop otomatis"
      ]
    },
    {
      title: "Double-Tap Magic ✨",
      description: "Ketuk dua kali untuk kontrol cepat video!",
      icon: <div className="flex space-x-2"><FaBackward className="text-2xl text-blue-500" /><FaForward className="text-2xl text-green-500" /></div>,
      features: [
        "Double-tap kiri: mundur 2 detik",
        "Double-tap kanan: maju 2 detik", 
        "Single-tap: play/pause"
      ]
    },
    {
      title: "Interaksi Sosial",
      description: "Like video favorit Anda dan berinteraksi!",
      icon: <FaHeart className="text-4xl text-pink-500" />,
      features: [
        "Tap ❤️ untuk like video",
        "Lihat jumlah views real-time",
        "Komentar dan share (coming soon)"
      ]
    },
    {
      title: "Kontrol Audio",
      description: "Atur suara sesuai preferensi Anda",
      icon: <FaVolumeUp className="text-4xl text-purple-500" />,
      features: [
        "Tap ikon speaker untuk mute/unmute",
        "Audio otomatis muted saat scroll",
        "Kontrol volume sistem"
      ]
    },
    {
      title: "Profil & Eksplorasi",
      description: "Kelola profil dan jelajahi konten",
      icon: <div className="flex space-x-2"><FaUser className="text-2xl text-indigo-500" /><FaSearch className="text-2xl text-yellow-500" /></div>,
      features: [
        "Edit profil dan foto profil",
        "Lihat video yang di-like",
        "Mode eksplorasi grid view"
      ]
    },
    {
      title: "Siap Menjelajahi! 🚀",
      description: "Sekarang Anda siap menikmati pengalaman Bubblegum yang seru!",
      icon: "🎬",
      features: [
        "Swipe untuk mulai menonton",
        "Jelajahi ribuan video menarik",
        "Bersenang-senang!"
      ]
    }
  ];

  const nextStep = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipOnboarding = () => {
    onClose();
  };

  if (!isOpen) return null;

  const currentStepData = onboardingSteps[currentStep];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl max-w-md w-full mx-4 overflow-hidden border border-gray-700 shadow-2xl"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-pink-500 to-purple-600 p-6 text-center">
              <button
                onClick={skipOnboarding}
                className="absolute top-4 right-4 text-white/80 hover:text-white text-xl"
              >
                <FaTimes />
              </button>
              
              <div className="mb-4">
                {typeof currentStepData.icon === 'string' ? (
                  <div className="text-6xl mb-2">{currentStepData.icon}</div>
                ) : (
                  <div className="flex justify-center mb-2">{currentStepData.icon}</div>
                )}
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-2">
                {currentStepData.title}
              </h2>
              
              <p className="text-white/90 text-sm">
                {currentStepData.description}
              </p>
            </div>

            {/* Content */}
            <div className="p-6">
              {currentStepData.features.length > 0 && (
                <div className="space-y-3 mb-6">
                  {currentStepData.features.map((feature, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center text-gray-300"
                    >
                      <div className="w-2 h-2 bg-pink-500 rounded-full mr-3 flex-shrink-0"></div>
                      <span className="text-sm">{feature}</span>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Progress dots */}
              <div className="flex justify-center space-x-2 mb-6">
                {onboardingSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      index === currentStep 
                        ? 'bg-pink-500 w-6' 
                        : index < currentStep 
                          ? 'bg-green-500' 
                          : 'bg-gray-600'
                    }`}
                  />
                ))}
              </div>

              {/* Navigation buttons */}
              <div className="flex justify-between items-center">
                <button
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    currentStep === 0
                      ? 'text-gray-500 cursor-not-allowed'
                      : 'text-gray-300 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <FaChevronLeft className="mr-1" />
                  Sebelumnya
                </button>

                <span className="text-gray-400 text-sm">
                  {currentStep + 1} / {onboardingSteps.length}
                </span>

                <button
                  onClick={nextStep}
                  className="flex items-center px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg text-sm font-medium hover:from-pink-600 hover:to-purple-600 transition-all shadow-lg"
                >
                  {currentStep === onboardingSteps.length - 1 ? (
                    'Mulai! 🚀'
                  ) : (
                    <>
                      Selanjutnya
                      <FaChevronRight className="ml-1" />
                    </>
                  )}
                </button>
              </div>

              {/* Skip button */}
              <div className="text-center mt-4">
                <button
                  onClick={skipOnboarding}
                  className="text-gray-500 text-sm hover:text-gray-300 transition-colors"
                >
                  Lewati tutorial
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OnboardingModal; 