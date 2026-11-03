"use client";
import { motion } from "framer-motion";
import { ExchangeBookSummaryCard } from "@/components/cards/exchange-book-summary";

export function ExchangeStory() {
  return (
    <div className="relative p-6 md:p-10 rounded-[2.5rem] bg-gradient-to-br from-[#fffbf5] to-[#f7efe5] shadow-[inset_6px_6px_12px_rgba(31,22,18,0.04),inset_-6px_-6px_12px_rgba(255,255,255,0.9)] overflow-hidden">
      
      {/* Header */}
      <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-xs font-extrabold tracking-widest uppercase text-[#ea6113]">One shelf. Two new chapters.</p>
        <span className="inline-block self-start sm:self-auto px-4 py-1.5 bg-white rounded-full text-[10px] font-bold text-slate-400 shadow-inner">
          Illustrative Exchange
        </span>
      </div>

      {/* Main Interactive Stage */}
      <div className="relative flex flex-col items-center gap-2 py-4 max-w-sm mx-auto">
        
        {/* Top Book (You Give) - Shifted Left */}
        <motion.div 
          animate={{ y: [0, -6, 0] }} 
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="w-[260px] max-w-full self-start md:-ml-8 relative z-10"
        >
          <div className="bg-white p-5 rounded-[2rem] shadow-[8px_8px_20px_rgba(31,22,18,0.06),-8px_-8px_20px_rgba(255,255,255,0.9)]">
            <ExchangeBookSummaryCard 
              label="You give" 
              book={{ title: "A story you loved", author: "From your shelf" }} 
            />
          </div>
        </motion.div>

        {/* Animated Exchange Hub - Center */}
        <div className="relative z-20 my-[-1.5rem]">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 rounded-full bg-[#ffe3b3] flex items-center justify-center text-[#a83f08] shadow-[inset_4px_4px_8px_rgba(255,255,255,0.9),inset_-4px_-4px_8px_rgba(234,97,19,0.15),4px_4px_10px_rgba(31,22,18,0.05)] border-4 border-[#fffbf5]"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </motion.div>
        </div>

        {/* Bottom Book (You Receive) - Shifted Right */}
        <motion.div 
          animate={{ y: [0, 6, 0] }} 
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="w-[260px] max-w-full self-end md:-mr-8 relative z-10"
        >
          <div className="bg-white p-5 rounded-[2rem] shadow-[8px_8px_20px_rgba(31,22,18,0.06),-8px_-8px_20px_rgba(255,255,255,0.9)]">
            <ExchangeBookSummaryCard 
              label="You receive" 
              book={{ title: "Your next good read", author: "From a campus reader" }} 
            />
          </div>
        </motion.div>

      </div>

      {/* Footer Note */}
      <p className="mt-12 text-sm font-semibold text-slate-500 text-center leading-relaxed">
        Offer a book. Agree on the exchange. Meet on campus.
      </p>
    </div>
  );
}