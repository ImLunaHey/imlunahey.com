import { motion } from 'framer-motion';

export const Loading = () => {
  return (
    <div className="font-doto flex items-center justify-center gap-2 text-4xl">
      {Array.from({ length: 3 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.3,
          }}
          children="."
        />
      ))}
    </div>
  );
};
