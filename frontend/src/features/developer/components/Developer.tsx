"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { Github, Linkedin, Mail, Database, LayoutTemplate, Server, HomeIcon } from "lucide-react";

export default function Developer() {
  const fadeUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <div className="relative min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-orange-500/20 selection:text-orange-200 overflow-x-hidden">
      {/* Subtle Panning Dot Grid */}
      <div 
        className="fixed inset-0 z-0 opacity-[0.15] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          animation: 'panGrid 60s linear infinite'
        }}
      />
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes panGrid {
          0% { background-position: 0px 0px; }
          100% { background-position: 240px 240px; }
        }
      `}} />

      {/* Top Gradient Fade to blend grid */}
      <div className="fixed top-0 left-0 right-0 h-32 bg-linear-to-b from-[#020617] to-transparent z-0 pointer-events-none" />

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-32 space-y-24">
        
        {/* Hero Section */}
        <motion.section 
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="space-y-6"
        >
          <div className="inline-block px-3 py-1 rounded border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <span className="text-xs font-mono uppercase tracking-widest text-orange-400/90">
              Solo Architect & Developer
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-100">
            Sanheeth Singh
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl leading-relaxed">
            Engineering the book exchange platform end-to-end. Building asynchronous backend engines and tactile, glassmorphic interfaces without the overhead of external teams.
          </p>
        </motion.section>

        {/* Architecture Breakdown */}
        <section className="space-y-8">
          <motion.h2 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={fadeUp}
            className="text-xl font-mono text-slate-100 flex items-center gap-3"
          >
            <Server className="w-5 h-5 text-orange-400" />
            System Architecture
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Backend Module */}
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={fadeUp}
              className="p-8 rounded-xl bg-slate-900/40 border border-slate-800 backdrop-blur-md hover:border-orange-500/30 transition-colors duration-300"
            >
              <Database className="w-6 h-6 text-slate-400 mb-6" />
              <h3 className="text-lg font-bold text-slate-200 mb-2">The Engine</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Powered by an asynchronous backend designed for real-time peer interactions. Containerized workflows ensuring strict database consistency.
              </p>
              <div className="flex flex-wrap gap-2">
                {['FastAPI', 'PostgreSQL', 'asyncpg', 'Alembic', 'Docker Compose', 'WebSockets'].map(tech => (
                  <span key={tech} className="px-2 py-1 text-xs font-mono rounded bg-[#020617] text-slate-400 border border-slate-800">
                    {tech}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Frontend Module */}
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={fadeUp}
              className="p-8 rounded-xl bg-slate-900/40 border border-slate-800 backdrop-blur-md hover:border-orange-500/30 transition-colors duration-300"
            >
              <LayoutTemplate className="w-6 h-6 text-slate-400 mb-6" />
              <h3 className="text-lg font-bold text-slate-200 mb-2">The Interface</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                A highly tactile, responsive client favoring fluid slide-over drawers and glassmorphism over standard modal interruptions.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Next.js', 'TypeScript', 'Tailwind CSS', 'Framer Motion', 'Lucide'].map(tech => (
                  <span key={tech} className="px-2 py-1 text-xs font-mono rounded bg-[#020617] text-slate-400 border border-slate-800">
                    {tech}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Minimalist Connect */}
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="pt-12 border-t border-slate-800/50 flex gap-6"
        >
          <Link href="https://github.com/sanheeth-singh" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 text-slate-500 hover:text-orange-400 transition-colors">
            <Github className="w-5 h-5" />
            <span className="text-sm font-mono">GitHub</span>
          </Link>
          <Link href="https://www.linkedin.com/in/sanheeth-singh" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 text-slate-500 hover:text-orange-400 transition-colors">
            <Linkedin className="w-5 h-5" />
            <span className="text-sm font-mono">LinkedIn</span>
          </Link>
          <button 
            onClick={() => navigator.clipboard.writeText('sanheethsingh@gmail.com')}
            className="group flex items-center gap-2 text-slate-500 hover:text-orange-400 transition-colors"
          >
            <Mail className="w-5 h-5" />
            <span className="text-sm font-mono">Copy Email</span>
          </button>
          <Link href="/" className="group flex items-center gap-2 text-slate-500 hover:text-orange-400 transition-colors">
                <HomeIcon className="w-5 h-5"/> Swappy
          </Link>
        </motion.section>

      </main>
    </div>
  );
}