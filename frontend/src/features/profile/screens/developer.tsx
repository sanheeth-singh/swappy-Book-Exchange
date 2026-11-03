"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export function AboutDeveloperScreen() {
  const [isBooting, setIsBooting] = useState(true);

  // Simulate Terminal Boot Sequence
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsBooting(false);
    }, 2800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-[#2dd4bf] selection:text-[#020617] overflow-x-hidden">
      <AnimatePresence>
        {isBooting ? (
          <motion.div
            key="terminal"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#020617] font-mono text-[#2dd4bf] p-4"
          >
            <div className="w-full max-w-2xl">
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm md:text-base"
              >
                $ bunnyme9 --init
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-sm md:text-base mt-2"
              >
                &gt; Loading architect profile: Sanheeth Singh...
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.6 }}
                className="text-sm md:text-base mt-2"
              >
                &gt; Resolving dependencies: Next.js, FastAPI, PostgreSQL...
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.2 }}
                className="text-sm md:text-base mt-2 text-[#c084fc]"
              >
                &gt; System ready. Entering Midnight Clay.
              </motion.p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="main-ui"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative z-10"
          >
            {/* Ambient Background Glows */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
              <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-[#2dd4bf] rounded-full mix-blend-screen filter blur-[150px] opacity-[0.07]" />
              <div className="absolute bottom-[-20%] right-[-10%] w-[40vw] h-[40vw] bg-[#c084fc] rounded-full mix-blend-screen filter blur-[120px] opacity-[0.07]" />
            </div>

            <div className="max-w-5xl mx-auto px-6 py-24 space-y-32 relative z-10">
              
              {/* 1. Hero Section */}
              <section className="text-center space-y-6">
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", bounce: 0.5, delay: 0.4 }}
                  className="inline-block px-5 py-2 rounded-full bg-[#0f172a] border border-[#1e293b] shadow-[inset_2px_2px_4px_rgba(255,255,255,0.05),4px_4px_10px_rgba(0,0,0,0.5)]"
                >
                  <span className="text-xs font-bold uppercase tracking-widest text-[#2dd4bf]">
                    Architect & Developer
                  </span>
                </motion.div>
                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white">
                  Sanheeth Singh
                </h1>
                <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                  Building the backend engines and tactile frontends of tomorrow. From scalable databases to interactive web applications.
                </p>
              </section>

              {/* 2. Stack Matrix */}
              <section className="space-y-12">
                <div className="text-center space-y-4">
                  <h2 className="text-3xl font-extrabold text-white">The Tech Stack</h2>
                  <p className="text-slate-400">Powered by modern paradigms and robust architecture.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Frontend Chip */}
                  <motion.div 
                    whileHover={{ y: -5, scale: 1.02 }}
                    className="p-8 rounded-[2rem] bg-[#0f172a] shadow-[inset_2px_2px_8px_rgba(255,255,255,0.05),inset_-2px_-2px_8px_rgba(0,0,0,0.6),10px_10px_20px_rgba(0,0,0,0.5)] border border-[#1e293b]/50 group transition-all"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-[#020617] flex items-center justify-center mb-6 shadow-[inset_2px_2px_4px_rgba(45,212,191,0.2)]">
                      <svg className="w-7 h-7 text-[#2dd4bf]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">Frontend Engineering</h3>
                    <p className="text-slate-400 leading-relaxed mb-6">
                      Crafting highly interactive, mobile-responsive interfaces using React, Next.js, and TypeScript, styled with custom tactile CSS principles.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {['React', 'Next.js', 'TypeScript', 'Tailwind', 'Framer Motion'].map(tech => (
                        <span key={tech} className="px-3 py-1 text-xs font-semibold rounded-full bg-[#020617] text-[#2dd4bf] border border-[#2dd4bf]/20">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </motion.div>

                  {/* Backend Chip */}
                  <motion.div 
                    whileHover={{ y: -5, scale: 1.02 }}
                    className="p-8 rounded-[2rem] bg-[#0f172a] shadow-[inset_2px_2px_8px_rgba(255,255,255,0.05),inset_-2px_-2px_8px_rgba(0,0,0,0.6),10px_10px_20px_rgba(0,0,0,0.5)] border border-[#1e293b]/50 group transition-all"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-[#020617] flex items-center justify-center mb-6 shadow-[inset_2px_2px_4px_rgba(192,132,252,0.2)]">
                      <svg className="w-7 h-7 text-[#c084fc]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">Backend & Infrastructure</h3>
                    <p className="text-slate-400 leading-relaxed mb-6">
                      Architecting secure APIs and relational database systems utilizing FastAPI, SQLAlchemy, Pydantic, and PostgreSQL.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {['FastAPI', 'PostgreSQL', 'SQLAlchemy', 'Python', 'AWS', 'Django'].map(tech => (
                        <span key={tech} className="px-3 py-1 text-xs font-semibold rounded-full bg-[#020617] text-[#c084fc] border border-[#c084fc]/20">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </section>

              {/* 3. The Winding Timeline */}
              <section className="space-y-16">
                <div className="text-center space-y-4">
                  <h2 className="text-3xl font-extrabold text-white">The Journey</h2>
                  <p className="text-slate-400">Milestones in development and research.</p>
                </div>

                <div className="relative border-l-2 border-[#1e293b] ml-4 md:ml-12 space-y-12 pb-8">
                  
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    className="relative pl-8 md:pl-12"
                  >
                    <div className="absolute left-[-9px] top-1 w-4 h-4 rounded-full bg-[#2dd4bf] shadow-[0_0_10px_rgba(45,212,191,0.5)]" />
                    <h3 className="text-xl font-bold text-white">Datheon AI Research Internship</h3>
                    <p className="text-sm font-semibold text-[#2dd4bf] mt-1">Virtual Engineering Researcher</p>
                    <p className="text-slate-400 mt-3 leading-relaxed max-w-2xl">
                      Explored advanced artificial intelligence engineering concepts, applying cutting-edge research to practical architectural patterns.
                    </p>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    className="relative pl-8 md:pl-12"
                  >
                    <div className="absolute left-[-9px] top-1 w-4 h-4 rounded-full bg-[#c084fc] shadow-[0_0_10px_rgba(192,132,252,0.5)]" />
                    <h3 className="text-xl font-bold text-white">Educational Full-Stack Solutions</h3>
                    <p className="text-sm font-semibold text-[#c084fc] mt-1">Jalna City</p>
                    <p className="text-slate-400 mt-3 leading-relaxed max-w-2xl">
                      Developed a comprehensive web application for a local educational institution, featuring role-based management dashboards, dynamic event posts, and integrated public marketing content.
                    </p>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    className="relative pl-8 md:pl-12"
                  >
                    <div className="absolute left-[-9px] top-1 w-4 h-4 rounded-full bg-[#2dd4bf] shadow-[0_0_10px_rgba(45,212,191,0.5)]" />
                    <h3 className="text-xl font-bold text-white">Foundations & Infrastructure</h3>
                    <p className="text-sm font-semibold text-[#2dd4bf] mt-1">AWS & Django Certification</p>
                    <p className="text-slate-400 mt-3 leading-relaxed max-w-2xl">
                      Solidified backend engineering practices through certified foundational training in Django and extensive cloud infrastructure work with AWS Skill Builder and Cloud Institute.
                    </p>
                  </motion.div>

                </div>
              </section>

              {/* 4. The bunnyMe9 Easter Egg Playground */}
              <section className="py-12 flex flex-col items-center justify-center">
                <p className="text-sm font-semibold text-slate-500 mb-8 uppercase tracking-widest">Interactive Gravity Sandbox</p>
                <div className="w-full h-[300px] rounded-[3rem] bg-[#0f172a] border border-[#1e293b]/50 shadow-inner overflow-hidden relative flex items-center justify-center">
                  <span className="absolute text-slate-700/30 font-extrabold text-4xl select-none pointer-events-none">
                    Toss the elements around
                  </span>
                  
                  <motion.div
                    drag
                    dragConstraints={{ left: -100, right: 100, top: -100, bottom: 100 }}
                    dragElastic={0.4}
                    whileTap={{ cursor: "grabbing", scale: 0.95 }}
                    className="absolute z-10 px-8 py-4 rounded-full bg-[#c084fc] text-[#020617] font-extrabold text-xl shadow-[0_0_30px_rgba(192,132,252,0.4)] cursor-grab"
                  >
                    bunnyMe9
                  </motion.div>
                  
                  <motion.div
                    drag
                    dragConstraints={{ left: -150, right: 150, top: -100, bottom: 100 }}
                    dragElastic={0.2}
                    whileTap={{ cursor: "grabbing", scale: 0.9 }}
                    className="absolute z-10 px-6 py-3 rounded-[1rem] bg-[#020617] text-[#2dd4bf] border border-[#2dd4bf]/50 font-bold shadow-[0_0_20px_rgba(45,212,191,0.2)] cursor-grab ml-[200px] mt-[100px]"
                  >
                    Full-Stack
                  </motion.div>
                </div>
              </section>

              {/* 5. Quick-Connect Console */}
              <section className="pt-8 pb-12">
                <div className="max-w-fit mx-auto p-4 rounded-full bg-[#0f172a] border border-[#1e293b] shadow-[inset_2px_2px_4px_rgba(255,255,255,0.05),0_10px_30px_rgba(0,0,0,0.5)] flex items-center gap-2 md:gap-4">
                  
                  <Link href="https://www.linkedin.com/in/sanheeth-singh" target="_blank" rel="noopener noreferrer">
                    <motion.button 
                      whileHover={{ scale: 1.1, backgroundColor: "#0284c7" }}
                      whileTap={{ scale: 0.95 }}
                      className="px-6 py-3 rounded-full bg-[#1e293b] text-white font-bold flex items-center gap-2 transition-colors shadow-clay-dark"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                      <span className="hidden sm:inline">LinkedIn</span>
                    </motion.button>
                  </Link>

                  <Link href="https://github.com" target="_blank" rel="noopener noreferrer">
                    <motion.button 
                      whileHover={{ scale: 1.1, backgroundColor: "#334155" }}
                      whileTap={{ scale: 0.95 }}
                      className="px-6 py-3 rounded-full bg-[#1e293b] text-white font-bold flex items-center gap-2 transition-colors shadow-clay-dark"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                      <span className="hidden sm:inline">GitHub</span>
                    </motion.button>
                  </Link>
                  
                  <motion.button 
                    whileHover={{ scale: 1.1, backgroundColor: "#2dd4bf", color: "#020617" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigator.clipboard.writeText('contact@bunnyme9.com')}
                    className="px-6 py-3 rounded-full bg-[#1e293b] text-white font-bold flex items-center gap-2 transition-colors shadow-clay-dark group"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    <span className="hidden sm:inline">Copy Email</span>
                  </motion.button>
                </div>
              </section>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}