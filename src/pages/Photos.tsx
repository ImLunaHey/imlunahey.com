import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import images from '../assets/images.json' with { type: 'json' };
const LensGallery = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);
  const [isInfoVisible, setIsInfoVisible] = useState(false);

  useEffect(() => {
    // Mark animation as complete after the sequence finishes
    const timer = setTimeout(() => {
      setIsAnimationComplete(true);
    }, 6000);

    return () => clearTimeout(timer);
  }, []);

  const handleImageSwap = (index: number) => {
    setIsInfoVisible(false);
    setCurrentImageIndex(index);
  };

  const toggleInfo = () => {
    if (isAnimationComplete) {
      setIsInfoVisible(!isInfoVisible);
    }
  };

  const currentImage = images[currentImageIndex];

  return (
    <div className="relative flex items-center justify-center w-full h-screen bg-black overflow-hidden">
      {/* Header */}
      <motion.div
        className="fixed top-10 w-full text-center font-light text-white z-10"
        style={{
          fontSize: 'min(48px, 10vw)',
          letterSpacing: 'max(10px, 2vw)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: isAnimationComplete ? 1 : 0 }}
        transition={{ duration: 1 }}
      >
        LUNA
      </motion.div>

      {/* Viewfinder */}
      <motion.div
        className="relative overflow-hidden"
        initial={{ width: '300px', height: '200px' }}
        animate={{
          width: '100vw',
          height: '100vh',
        }}
        transition={{ duration: 3, delay: 3, ease: 'easeInOut' }}
      >
        {/* Corners */}
        <Corner position="top-left" />
        <Corner position="top-right" />
        <Corner position="bottom-left" />
        <Corner position="bottom-right" />

        {/* Image Container */}
        <motion.div
          className="absolute w-full h-full"
          initial={{ clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)' }}
          animate={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
          transition={{ duration: 3, ease: 'easeInOut' }}
          onClick={toggleInfo}
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={currentImage.url}
              src={currentImage.url}
              alt={currentImage.title}
              className="w-full h-full object-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            />
          </AnimatePresence>

        </motion.div>
      </motion.div>

      {/* Thumbnails */}
      <motion.div
        className="fixed bottom-5 left-0 w-full overflow-x-auto z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: isAnimationComplete ? 1 : 0 }}
        transition={{ duration: 1 }}
      >
        <div className="flex gap-5 w-max mx-auto p-5">
          {images.map((image, index) => (
            <motion.div
              key={image.url}
              className={`w-24 h-16 cursor-pointer transition-all duration-300 ease-in-out ${
                index === currentImageIndex ? 'scale-110' : ''
              }`}
              initial={{ transform: 'translateX(100vw)' }}
              animate={{ transform: 'translateX(0)' }}
              transition={{
                duration: 1,
                ease: 'easeOut',
                delay: 6 + index * 0.1,
              }}
              onClick={() => handleImageSwap(index)}
              whileHover={{ scale: 1.05 }}
            >
              <img
                src={image.url}
                alt={`Thumbnail ${index + 1}`}
                className={`w-full h-full object-cover border-2 rounded transition-all duration-300 ${
                  index === currentImageIndex ? 'border-white shadow-lg shadow-white/50' : 'border-white/30'
                }`}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

// Corner component
const Corner = ({ position }: { position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) => {
  let borderClasses = '';

  switch (position) {
    case 'top-left':
      borderClasses = 'top-0 left-0 border-t-2 border-l-2';
      break;
    case 'top-right':
      borderClasses = 'top-0 right-0 border-t-2 border-r-2';
      break;
    case 'bottom-left':
      borderClasses = 'bottom-0 left-0 border-b-2 border-l-2';
      break;
    case 'bottom-right':
      borderClasses = 'bottom-0 right-0 border-b-2 border-r-2';
      break;
    default:
      borderClasses = '';
  }

  return (
    <motion.div
      className={`absolute w-8 h-8 border-white ${borderClasses} z-10`}
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 1, delay: 3 }}
    />
  );
};

export const PhotosPage = () => {
  return <LensGallery />;
};
