import React from 'react';
import { motion } from 'framer-motion';

export const SkeletonCard: React.FC = () => {
  return (
    <div className="rounded-[28px] p-6 glass-panel overflow-hidden relative">
      <div className="flex items-center gap-4 mb-4">
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-12 h-12 rounded-2xl bg-white/5"
        />
        <div className="flex-1 space-y-2">
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
            className="h-4 w-3/4 rounded-full bg-white/5"
          />
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
            className="h-3 w-1/2 rounded-full bg-white/5"
          />
        </div>
      </div>
      <div className="space-y-2">
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
          className="h-3 w-full rounded-full bg-white/5"
        />
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.8 }}
          className="h-3 w-full rounded-full bg-white/5"
        />
      </div>
    </div>
  );
};

export const SkeletonList: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
};
