"use client";
import { useId, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { REUSE_MIN, REUSE_MAX, reuseIllustration } from "../reuse";

export function ReuseSlider() {
  const [value, setValue] = useState(4);
  const id = useId();
  const impact = reuseIllustration(value);

  const increment = () => setValue((current) => Math.min(REUSE_MAX, current + 1));
  const decrement = () => setValue((current) => Math.max(REUSE_MIN, current - 1));

  return (
    <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-[10px_10px_20px_rgba(31,22,18,0.04),-10px_-10px_20px_rgba(255,255,255,0.9)] max-w-4xl mx-auto flex flex-col md:flex-row gap-12 items-center">
      
      <div className="flex-1 space-y-4 text-center md:text-left">
        <p className="text-xs font-extrabold tracking-widest uppercase text-[#ea6113]">Small exchanges. More reuse.</p>
        <h2 className="text-3xl font-extrabold text-slate-800">Keep good books in circulation.</h2>
        <p className="text-slate-500 font-medium leading-relaxed">
          Every two-way exchange passes two existing books to their next readers. Adjust the slider to see what a little sharing could look like on your campus.
        </p>
        <p id={`${id}-note`} className="text-[10px] font-bold text-slate-400 pt-2 uppercase tracking-wide">
          * Illustrative metric only.
        </p>
      </div>

      <div className="flex-1 w-full bg-[#f7efe5] p-6 md:p-8 rounded-[2rem] shadow-[inset_4px_4px_8px_rgba(31,22,18,0.03),inset_-4px_-4px_8px_rgba(255,255,255,0.9)]">
        
        <div className="flex items-center justify-between mb-8">
          <label htmlFor={id} className="text-sm font-bold text-slate-700">Projected Exchanges</label>
          <motion.div 
            key={value}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-12 h-12 bg-white rounded-full flex items-center justify-center font-extrabold text-[#a83f08] shadow-clay"
          >
            {impact.exchanges}
          </motion.div>
        </div>

        <div className="flex items-center gap-4 mb-10">
          <button 
            aria-label="Fewer exchanges" 
            disabled={value <= REUSE_MIN} 
            onClick={decrement}
            className="w-12 h-12 shrink-0 rounded-full bg-white flex items-center justify-center text-slate-500 shadow-clay disabled:opacity-50 active:scale-95 transition-transform"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" /></svg>
          </button>
          
          <div className="flex-1 relative">
            <input 
              id={id} 
              type="range" 
              min={REUSE_MIN} 
              max={REUSE_MAX} 
              step={1} 
              value={value} 
              onInput={(event) => setValue(event.currentTarget.valueAsNumber)} 
              onChange={(event) => setValue(event.currentTarget.valueAsNumber)} 
              className="w-full h-3 bg-white rounded-full appearance-none outline-none shadow-inner accent-[#ea6113] cursor-pointer" 
              aria-describedby={`${id}-note`} 
            />
          </div>

          <button 
            aria-label="More exchanges" 
            disabled={value >= REUSE_MAX} 
            onClick={increment}
            className="w-12 h-12 shrink-0 rounded-full bg-white flex items-center justify-center text-slate-500 shadow-clay disabled:opacity-50 active:scale-95 transition-transform"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4" aria-live="polite" aria-atomic="true">
          <div className="bg-white p-4 rounded-2xl shadow-[4px_4px_8px_rgba(31,22,18,0.04),-4px_-4px_8px_rgba(255,255,255,0.9)] text-center">
            <AnimatePresence mode="popLayout">
              <motion.span key={impact.exchanges} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="block text-2xl font-extrabold text-slate-800">
                {impact.exchanges}
              </motion.span>
            </AnimatePresence>
            <span className="text-xs font-bold text-slate-500 mt-1 block">Two-way Swaps</span>
          </div>
          <div className="bg-[#ffe3b3] p-4 rounded-2xl shadow-[4px_4px_8px_rgba(234,97,19,0.1),-4px_-4px_8px_rgba(255,255,255,0.9)] text-center">
            <AnimatePresence mode="popLayout">
              <motion.span key={impact.handovers} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="block text-2xl font-extrabold text-[#a83f08]">
                {impact.handovers}
              </motion.span>
            </AnimatePresence>
            <span className="text-xs font-bold text-[#873206] mt-1 block">Books Handed Over</span>
          </div>
        </div>

      </div>
    </div>
  );
}