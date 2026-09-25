import { motion } from 'framer-motion';
import { X, Mail, Gamepad2, Globe } from 'lucide-react';

interface CreditsProps {
  onClose: () => void;
}

// Creator / studio credits, shown as an overlay from the landing page and the
// pause menu so it never unmounts an in-progress fight. Single column in
// portrait, two columns in landscape. Details use a normal sans font (the
// global arcade pixel font is very wide) and flex children carry min-w-0 /
// break-words so nothing clips at the breakpoint. Closed via the corner ✕ or a
// tap outside the card — no bulky button needed.
export default function Credits({ onClose }: CreditsProps) {
  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative w-full max-w-sm landscape:max-w-xl max-h-[94dvh] overflow-y-auto no-scrollbar
                 rounded-2xl border border-white/10 bg-gradient-to-b from-gray-900 to-black
                 px-5 py-4 shadow-2xl"
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close credits"
          className="absolute top-2 right-2 w-7 h-7 rounded-md bg-gray-800/70 hover:bg-gray-700/70
                   flex items-center justify-center text-gray-300 z-10"
        >
          <X size={15} />
        </button>

        <div className="flex flex-col gap-3 landscape:flex-row landscape:items-center landscape:gap-5">
          {/* Brand */}
          <div className="text-center landscape:text-left landscape:shrink-0 landscape:max-w-[46%]">
            <div className="flex items-center justify-center landscape:justify-start gap-2 text-2xl">
              <span>🥷</span>
              <Gamepad2 className="w-6 h-6 text-yellow-500" />
              <span>💥</span>
            </div>
            <h2 className="mt-1 font-arcade text-base sm:text-lg tracking-wide bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
              Emoji Fighter
            </h2>
          </div>

          {/* Details — sans font, min-w-0 so long strings wrap instead of clipping. */}
          <div className="font-sans flex-1 min-w-0 space-y-2 text-center landscape:text-left
                        landscape:border-l landscape:border-white/10 landscape:pl-5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Created by</div>
              <div className="text-base font-bold text-white leading-tight">Kasey Randall</div>
              <div className="text-xs text-yellow-400">Design · Development · Art Direction</div>
              <a
                href="https://kaseyrandall.design"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-200 hover:underline"
              >
                <Globe size={13} className="shrink-0" />
                kaseyrandall.design
              </a>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Studio</div>
              <div className="text-sm font-semibold text-gray-100">Edge Kase Interactive</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 mb-0.5">Contact</div>
              <a
                href="mailto:edgekaseinteractive@gmail.com"
                className="inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-200 hover:underline break-all"
              >
                <Mail size={13} className="shrink-0" />
                edgekaseinteractive@gmail.com
              </a>
            </div>
          </div>
        </div>

        <div className="font-sans mt-3 pt-3 border-t border-white/10 text-[10px] text-gray-500 text-center">
          © 2026 Edge Kase Interactive. All Rights Reserved.
        </div>
      </motion.div>
    </motion.div>
  );
}
