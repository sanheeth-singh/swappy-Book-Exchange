"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DiscoveryLink } from "@/components/ui/discovery-link";
import { ButtonLink } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { ExchangeStory } from "../components/exchange-story";
import { ReuseSlider } from "../components/reuse-slider";
import Link from "next/link";

const steps = [
  {
    number: "01",
    title: "Find a book",
    body: "Explore the public preview, then discover your campus shelves after completing your profile.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
    )
  },
  {
    number: "02",
    title: "Offer an exchange",
    body: "With active campus verification, offer your book for another student’s listing.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
    )
  },
  {
    number: "03",
    title: "Meet and confirm",
    body: "After acceptance, arrange a handover. Each person confirms the book they received.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
    )
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function HomeScreen() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="overflow-hidden">
      {/* 1. Immersive Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center pt-20 pb-16 px-4 md:px-8">
        {/* Subtle background clay blobs */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 bg-[#fffbf5]">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#ffe3b3] rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-blob" />
          <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-[#f7efe5] rounded-full mix-blend-multiply filter blur-[80px] opacity-60 animate-blob animation-delay-2000" />
        </div>

        <motion.div 
          initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }}
          className="max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
        >
          <div className="space-y-6 text-center lg:text-left">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-clay text-[#a83f08] font-bold text-xs uppercase tracking-widest">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              Good reads. Closer to home.
            </motion.div>
            
            <motion.h1 variants={fadeUp} className="text-5xl md:text-6xl font-extrabold text-slate-800 tracking-tight leading-[1.1]">
              Your next read is on <span className="text-transparent bg-clip-text bg-linear-to-r from-[#ea6113] to-[#a83f08]">someone else’s shelf.</span>
            </motion.h1>
            
            <motion.p variants={fadeUp} className="text-lg text-slate-500 font-medium max-w-lg mx-auto lg:mx-0 leading-relaxed">
              Pass on a book you loved. Find a story you haven’t met. Exchange seamlessly with students right on your campus.
            </motion.p>
            
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
              <ButtonLink href="/register" className="button-primary px-8 py-4 w-full sm:w-auto text-lg shadow-[6px_6px_12px_rgba(234,97,19,0.25),-4px_-4px_10px_rgba(255,255,255,0.8)]">
                Join your campus
              </ButtonLink>
              <div className="w-full sm:w-auto">
                <DiscoveryLink />
              </div>
            </motion.div>
          </div>

          <motion.div variants={fadeUp} className="relative z-10 w-full mt-12 lg:mt-0">
            <ExchangeStory />
          </motion.div>
        </motion.div>
      </section>

      {/* 2. Interactive Steps Section */}
      <section className="py-24 px-4 bg-white relative z-10" aria-labelledby="how-heading">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 id="how-heading" className="text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight">
              From your shelf to theirs.
            </h2>
            <p className="text-slate-500 font-medium">A simple, verified exchange process.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step, index) => {
              const isActive = activeStep === index;
              return (
                <motion.div 
                  key={step.number}
                  onClick={() => setActiveStep(index)}
                  className={`relative cursor-pointer p-8 rounded-[2rem] transition-all duration-300 ${
                    isActive 
                      ? 'bg-linear-to-br from-[#fffbf5] to-[#f7efe5] shadow-[inset_6px_6px_12px_rgba(31,22,18,0.04),inset_-6px_-6px_12px_rgba(255,255,255,0.9)] scale-105 z-10' 
                      : 'bg-white shadow-[6px_6px_12px_rgba(31,22,18,0.04),-6px_-6px_12px_rgba(255,255,255,0.9)] hover:scale-105 z-0'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-6 shadow-inner transition-colors ${
                    isActive ? 'bg-white text-[#ea6113]' : 'bg-[#f7efe5] text-slate-400'
                  }`}>
                    {step.icon}
                  </div>
                  
                  <div className="space-y-2">
                    <span className={`text-xs font-extrabold tracking-widest uppercase ${isActive ? 'text-[#ea6113]' : 'text-slate-400'}`}>
                      Step {step.number}
                    </span>
                    <h3 className="text-xl font-bold text-slate-800">{step.title}</h3>
                  </div>

                  <AnimatePresence>
                    {isActive && (
                      <motion.p 
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="text-slate-600 font-medium leading-relaxed"
                      >
                        {step.body}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
          
          <div className="text-center pt-8">
            <ButtonLink href="/help#exchange-journey" variant="ghost" className="text-slate-500 font-bold hover:text-[#ea6113]">
              Read the full guide →
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* 3. Visual Break - Reuse Slider */}
      <section className="py-24 bg-[#fffbf5] relative shadow-[inset_0_10px_20px_rgba(31,22,18,0.02)]" aria-label="Book reuse illustration">
        <div className="max-w-6xl mx-auto px-4">
          <ReuseSlider />
        </div>
      </section>

      {/* 4. Verification & FAQ Inset Cards */}
      <section className="py-24 px-4 bg-white space-y-8 max-w-5xl mx-auto" aria-labelledby="questions-heading">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Verification Callout */}
          <div className="p-10 rounded-[2rem] bg-linear-to-br from-[#ffe3b3] to-[#f7efe5] shadow-[6px_6px_12px_rgba(31,22,18,0.04),-6px_-6px_12px_rgba(255,255,255,0.9)] flex flex-col justify-between items-start space-y-6">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-[#27633e] shadow-clay">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Built around your campus.</h2>
              <p className="text-slate-600 font-medium leading-relaxed">
                Creating listings and starting exchanges require active campus verification. Browse first, learn the rules, then take part when you’re ready.
              </p>
            </div>
            <ButtonLink href="/help#membership" className="button-secondary bg-white">
              About verification
            </ButtonLink>
          </div>

          {/* Interactive FAQs */}
          <div className="p-10 rounded-[2rem] bg-[#f7efe5] shadow-[inset_6px_6px_12px_rgba(31,22,18,0.04),inset_-6px_-6px_12px_rgba(255,255,255,0.9)] space-y-6">
            <h2 id="questions-heading" className="text-2xl font-bold text-slate-800 tracking-tight flex items-center justify-between">
              A few things to know.
              <ButtonLink href="/help" variant="ghost" className="text-sm text-[#ea6113] p-0 hover:bg-transparent">
                All help topics →
              </ButtonLink>
            </h2>
            <div className="space-y-4">
              <Disclosure title="Can I explore before registering?">
                <p className="text-slate-600 font-medium leading-relaxed pt-2">
                  Yes. Explore shows a limited, publicly shared selection. Full campus browsing requires an account with a completed name and campus selection.
                </p>
              </Disclosure>
              <Disclosure title="When should I confirm an exchange?">
                <p className="text-slate-600 font-medium leading-relaxed pt-2">
                  Only after you receive the physical book. Acceptance reserves the books in the system; it does not confirm that the handover happened.
                </p>
              </Disclosure>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Final CTA */}
      <section className="py-24 px-4 bg-[#fffbf5] text-center border-t border-[#f7efe5]">
        <div className="max-w-2xl mx-auto space-y-8">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight">
            A little space on your shelf. <br />
            <span className="text-[#a83f08]">A new story in your hands.</span>
          </h2>
          <div className="flex justify-center">
            <DiscoveryLink />
          </div>
        </div>
      </section>
    </div>
    

  );
}