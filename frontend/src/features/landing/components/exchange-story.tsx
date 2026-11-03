"use client";

import { motion } from "framer-motion";

export function ExchangeStory() {
  return (
    <div className="relative w-full overflow-hidden rounded-[2rem] border border-neutral-800 bg-neutral-950 p-6 shadow-2xl md:p-10">
      
      {/* Retro-Futuristic Grid Background Layer */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `linear-gradient(to right, #FFE3B3 1px, transparent 1px), linear-gradient(to bottom, #FFE3B3 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />
      {/* Soft radial glow to illuminate the center */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#EA6113] opacity-10 blur-[80px]" />

      {/* Header */}
      <div className="relative z-10 mb-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <p className="text-xs font-extrabold uppercase tracking-widest text-[#EA6113]">
          One shelf. Two new chapters.
        </p>
        <span className="inline-block self-start rounded-full border border-[#F88F22]/30 bg-[#F88F22]/10 px-4 py-1.5 text-[10px] font-bold text-[#FBB931] shadow-[0_0_10px_rgba(248,143,34,0.1)] backdrop-blur-md sm:self-auto">
          Illustrative Exchange
        </span>
      </div>

      {/* Main Interactive Stage */}
      <div className="relative mx-auto flex max-w-sm flex-col items-center gap-4 py-4">
        
        {/* Top Book Node (You Give) */}
        <motion.div 
          animate={{ y: [0, -4, 0] }} 
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="relative z-10 w-[260px] max-w-full self-start md:-ml-8"
        >
          <div className="flex flex-col overflow-hidden rounded-l-[4px] rounded-r-2xl border border-neutral-800 border-l-4 border-l-[#EA6113] bg-neutral-900/60 p-5 shadow-[4px_4px_15px_rgba(0,0,0,0.4)] backdrop-blur-md transition-colors hover:border-neutral-700 hover:border-l-[#EA6113]">
            <span className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#EA6113]">
              You Give
            </span>
            <h3 className="truncate text-base font-bold text-neutral-100">
              A story you loved
            </h3>
            <p className="mt-1 truncate text-xs text-neutral-500">
              From your campus shelf
            </p>
          </div>
        </motion.div>

        {/* Animated Exchange Hub - Center */}
        <div className="relative z-20 my-[-1rem]">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-[#F88F22]/40 bg-neutral-950/80 text-[#FBB931] shadow-[0_0_20px_rgba(234,97,19,0.2)] backdrop-blur-xl"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </motion.div>
        </div>

        {/* Bottom Book Node (You Receive) */}
        <motion.div 
          animate={{ y: [0, 4, 0] }} 
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          className="relative z-10 w-[260px] max-w-full self-end md:-mr-8"
        >
          <div className="flex flex-col overflow-hidden rounded-l-[4px] rounded-r-2xl border border-neutral-800 border-l-4 border-l-[#FBB931] bg-neutral-900/60 p-5 shadow-[4px_4px_15px_rgba(0,0,0,0.4)] backdrop-blur-md transition-colors hover:border-neutral-700 hover:border-l-[#FBB931]">
            <span className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#FBB931]">
              You Receive
            </span>
            <h3 className="truncate text-base font-bold text-neutral-100">
              Your next good read
            </h3>
            <p className="mt-1 truncate text-xs text-neutral-500">
              From a campus reader
            </p>
          </div>
        </motion.div>

      </div>

      {/* Footer Note */}
      <p className="relative z-10 mt-12 text-center text-sm font-medium leading-relaxed text-neutral-500">
        Offer a book. Agree on the exchange. Meet on campus.
      </p>
    </div>
  );
}