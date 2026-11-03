"use client";
import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { detailsApi, readingInterests } from "../details-api";
import { SettingsNavigation } from "@/features/account/components/settings-navigation";
import { ReaderAvatar } from "@/components/ui/reader-avatar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ErrorState } from "@/components/feedback/error-state";
import { FormError } from "@/components/feedback/form-error";
import type { components } from "@/lib/api/generated/schema";
import { motion } from "framer-motion";

// --- Animation Variants ---
const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function ReaderDetailsScreen() {
  const profile = useQuery({
    queryKey: ["profile", "own"],
    queryFn: detailsApi.own,
  });
  const avatars = useQuery({
    queryKey: ["profile", "avatars"],
    queryFn: detailsApi.avatars,
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8 px-4 md:px-0">
      <SettingsNavigation />
      
      <motion.header 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#f7efe5] shadow-[inset_2px_2px_4px_rgba(31,22,18,0.05)] text-[#a83f08] font-bold text-xs uppercase tracking-widest mb-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Public Persona
        </div>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 tracking-tight">Reader Details</h1>
            <p className="text-lg text-slate-500 font-medium max-w-xl">
              Craft your identity for the campus library. This is how other readers will see you.
            </p>
          </div>
          
          <ButtonLink variant="secondary" href="/profile" className="shrink-0 bg-white shadow-[6px_6px_12px_rgba(163,177,198,0.4),-6px_-6px_12px_rgba(255,255,255,0.9)]">
            <svg className="w-4 h-4 mr-2 text-[#ea6113]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.956 11.956 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Campus Verification
          </ButtonLink>
        </div>
      </motion.header>

      {profile.isPending || avatars.isPending ? (
        <div className="card p-12 flex flex-col justify-center items-center min-h-[300px] gap-6">
          <div className="relative w-16 h-16 rounded-full bg-[#ffe3b3] shadow-[inset_4px_4px_8px_rgba(255,255,255,0.9),inset_-4px_-4px_8px_rgba(234,97,19,0.1)] flex items-center justify-center">
            <svg className="w-8 h-8 text-[#a83f08] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-slate-500 font-bold tracking-wide animate-pulse">Loading profile data…</p>
        </div>
      ) : profile.isError || avatars.isError ? (
        <div className="card p-8 bg-[#fff0ee] shadow-[inset_4px_4px_8px_rgba(163,45,40,0.1)]">
          <ErrorState
            message={
              profile.error?.message ??
              avatars.error?.message ??
              "Profile unavailable."
            }
            retry={() => {
              void profile.refetch();
              void avatars.refetch();
            }}
          />
        </div>
      ) : (
        <DetailsForm
          key={profile.data!.id}
          profile={profile.data!}
          avatars={avatars.data!}
        />
      )}
    </div>
  );
}

function DetailsForm({
  profile,
  avatars,
}: {
  profile: components["schemas"]["PublicProfile"];
  avatars: components["schemas"]["AvatarResponse"][];
}) {
  const client = useQueryClient();
  const carouselRef = useRef<HTMLDivElement>(null);
  
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [selectedAvatarId, setSelectedAvatarId] = useState(profile.avatar_id);

  const selectedAvatarData = avatars.find((a) => a.id === selectedAvatarId) || avatars[0];

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <motion.form
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-8"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setPending(true);
        setError(undefined);
        setNotice(undefined);
        try {
          const user = await detailsApi.update({
            display_name: String(data.get("display_name")).trim(),
            bio: String(data.get("bio")).trim() || null,
            reading_interests: readingInterests(String(data.get("interests"))),
            avatar_id: selectedAvatarId,
          });
          client.setQueryData(["auth", "me"], user);
          await Promise.all([
            client.invalidateQueries({ queryKey: ["profile", "own"] }),
            client.invalidateQueries({ queryKey: ["reader", profile.id] }),
          ]);
          setNotice("Reader details successfully updated.");
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Profile could not be updated.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      {/* 
        Responsive Ordering: 
        Mobile: Avatar (order-1) stacks above Inputs (order-2)
        Desktop: Inputs (order-1) stay on the left, Avatar (order-2) on the right
      */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Basic Info & Bio */}
        <motion.div variants={fadeUp} className="md:col-span-7 order-2 md:order-1 card p-6 md:p-8 space-y-8">
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#ea6113]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Basic Info
            </h2>
            
            <label className="block space-y-2">
              <span className="font-bold text-slate-700 ml-1 text-sm tracking-wide">DISPLAY NAME</span>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <Input
                  name="display_name"
                  defaultValue={profile.display_name ?? ""}
                  required
                  minLength={1}
                  maxLength={80}
                  className="field pl-12 text-lg"
                  placeholder="How you appear to others"
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="font-bold text-slate-700 ml-1 text-sm tracking-wide">BIO</span>
              <Textarea
                name="bio"
                defaultValue={profile.bio ?? ""}
                maxLength={300}
                rows={4}
                className="field resize-none text-base leading-relaxed"
                placeholder="Tell the campus a bit about what you love to read..."
              />
            </label>
          </div>

          <hr className="border-t-2 border-[#f7efe5]" />

          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#ea6113]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Reading Persona
            </h2>
            
            <div className="space-y-2">
              <label className="block space-y-2">
                <span className="font-bold text-slate-700 ml-1 text-sm tracking-wide">GENRES & INTERESTS</span>
                <Input
                  name="interests"
                  defaultValue={profile.reading_interests.join(", ")}
                  aria-describedby="interests-help"
                  className="field"
                  placeholder="e.g. Sci-Fi, Fantasy, Biographies"
                />
              </label>
              <p id="interests-help" className="text-xs font-semibold text-slate-400 ml-1 flex items-center gap-1">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Separate up to 8 interests with commas (max 40 chars each).
              </p>
            </div>
          </div>
        </motion.div>

        {/* Avatar Selection */}
        <motion.div variants={fadeUp} className="md:col-span-5 order-1 md:order-2 space-y-6">
          <div className="card p-8 bg-gradient-to-br from-[#fffbf5] to-[#f7efe5] flex flex-col items-center text-center space-y-6">
            <h2 className="text-xl font-bold text-slate-800">Current Avatar</h2>
            
            <motion.div 
              key={selectedAvatarId}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.4 }}
              className="w-40 h-40 rounded-full bg-[#f7efe5] shadow-[12px_12px_24px_rgba(234,97,19,0.08),-12px_-12px_24px_rgba(255,255,255,0.9)] flex items-center justify-center border-4 border-white p-2"
            >
               <ReaderAvatar url={selectedAvatarData.url} name={selectedAvatarData.name} size={130} />
            </motion.div>
            
            <div>
              <p className="text-2xl font-extrabold text-[#a83f08]">{selectedAvatarData.name}</p>
              <p className="text-sm font-semibold text-slate-400 mt-1">Ready to explore</p>
            </div>
          </div>

          <div className="relative p-6 rounded-[2rem] bg-[#f7efe5] shadow-[inset_6px_6px_12px_rgba(31,22,18,0.06),inset_-6px_-6px_12px_rgba(255,255,255,0.9)] overflow-hidden">
            <div className="flex items-center justify-between mb-4 px-2">
              <span className="font-bold text-slate-700">Choose a new look</span>
              
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => scrollCarousel('left')}
                  className="w-9 h-9 rounded-full bg-[#fffbf5] shadow-[4px_4px_8px_rgba(234,97,19,0.1),-4px_-4px_8px_rgba(255,255,255,0.9)] flex items-center justify-center text-slate-500 hover:text-[#ea6113] active:shadow-[inset_2px_2px_4px_rgba(31,22,18,0.06)] transition-all"
                  aria-label="Scroll left"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button 
                  type="button" 
                  onClick={() => scrollCarousel('right')}
                  className="w-9 h-9 rounded-full bg-[#fffbf5] shadow-[4px_4px_8px_rgba(234,97,19,0.1),-4px_-4px_8px_rgba(255,255,255,0.9)] flex items-center justify-center text-slate-500 hover:text-[#ea6113] active:shadow-[inset_2px_2px_4px_rgba(31,22,18,0.06)] transition-all"
                  aria-label="Scroll right"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>

            {/* Visual Mobile Scroll Affordance Mask */}
            <div className="absolute right-0 top-16 bottom-0 w-12 bg-gradient-to-l from-[#f7efe5] to-transparent pointer-events-none z-10 md:hidden" />

            <div 
              ref={carouselRef}
              className="flex gap-4 overflow-x-auto pb-4 pt-2 px-2 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] scroll-smooth"
            >
              {avatars.map((avatar) => {
                const isSelected = avatar.id === selectedAvatarId;
                return (
                  <motion.label 
                    key={avatar.id} 
                    className="relative flex flex-col items-center gap-3 p-3 rounded-3xl cursor-pointer shrink-0 snap-center w-[100px]"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <input
                      type="radio"
                      name="avatar_id"
                      value={avatar.id}
                      checked={isSelected}
                      onChange={() => setSelectedAvatarId(avatar.id)}
                      className="sr-only"
                    />
                    
                    {isSelected && (
                      <motion.div
                        layoutId="active-avatar-ring"
                        className="absolute inset-0 rounded-[1.5rem] bg-white shadow-[6px_6px_12px_rgba(234,97,19,0.08),-6px_-6px_12px_rgba(255,255,255,0.9)] border-[3px] border-[#ea6113]"
                        initial={false}
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    
                    <div className="relative z-10 pt-1">
                      <ReaderAvatar url={avatar.url} name={avatar.name} size={60} />
                    </div>
                    <span className={`relative z-10 text-xs font-bold text-center w-full truncate px-1 transition-colors ${isSelected ? 'text-[#a83f08]' : 'text-slate-500'}`}>
                      {avatar.name}
                    </span>
                  </motion.label>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div variants={fadeUp} className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6 border-t-2 border-[#e8d7c4]/30">
        <div className="flex-1 w-full">
          <FormError message={error} />
          {notice && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              className="inline-flex items-center gap-3 px-6 py-3 bg-[#edf7ee] text-[#27633e] rounded-full shadow-[inset_2px_3px_6px_rgba(31,22,18,0.06)] font-bold text-sm w-full md:w-auto"
            >
              <div className="w-6 h-6 shrink-0 rounded-full bg-[#27633e] text-white flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              {notice}
            </motion.div>
          )}
        </div>
        
        <Button type="submit" disabled={pending} className="button-primary w-full md:w-auto px-10 py-4 text-lg shrink-0">
          {pending ? (
            <>
              <svg className="w-5 h-5 mr-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving Changes…
            </>
          ) : (
            <>
              Save Details
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </>
          )}
        </Button>
      </motion.div>
    </motion.form>
  );
}