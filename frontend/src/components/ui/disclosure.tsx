"use client";
import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Disclosure({ 
  title, 
  children, 
  open: defaultOpen = false 
}: { 
  title: string; 
  children: ReactNode; 
  open?: boolean 
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-2xl shadow-[4px_4px_8px_rgba(31,22,18,0.04),-4px_-4px_8px_rgba(255,255,255,0.9)] overflow-hidden transition-colors hover:shadow-[inset_2px_2px_4px_rgba(31,22,18,0.02)]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 text-left outline-none"
        aria-expanded={isOpen}
      >
        <span className="font-bold text-slate-800">{title}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="w-8 h-8 rounded-full bg-[#fffbf5] flex items-center justify-center shrink-0 ml-4 shadow-inner text-[#ea6113]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          >
            <div className="px-5 pb-5 pt-1 text-slate-600 font-medium leading-relaxed">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}