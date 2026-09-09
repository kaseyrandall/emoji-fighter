import React from 'react';
import { RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';

export default function OrientationModal() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
    >
      <div className="text-center">
        <RotateCcw className="w-20 h-20 mx-auto mb-6 text-yellow-500 animate-spin" />
        <h2 className="text-2xl font-bold mb-4">Please Rotate Your Device</h2>
        <p className="text-gray-400">
          For the best fighting experience, please turn your device to landscape mode
        </p>
      </div>
    </motion.div>
  );
}