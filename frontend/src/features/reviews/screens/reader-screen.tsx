"use client";
import { ReaderAvatar } from "@/components/ui/reader-avatar";
import { ReaderBooks } from "@/features/profile/components/reader-books";
import { ButtonLink } from "@/components/ui/button";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { reviewsApi } from "../api";
import { SafetyActions } from "@/features/blocking/components/safety-actions";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
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

export function ReaderScreen({ id }: { id: string }) {
  const { user } = useAuth();
  
  const profile = useQuery({
    queryKey: ["reader", id],
    queryFn: () => reviewsApi.profile(id),
  });
  
  const reputation = useQuery({
    queryKey: ["reputation", id],
    queryFn: () => reviewsApi.reputation(id),
  });
  
  const reviews = useInfiniteQuery({
    queryKey: ["reviews", "reader", id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => reviewsApi.list(id, pageParam),
    getNextPageParam: (p) => p.next_cursor ?? undefined,
  });
  
  const rep = reputation.data;
  const isOwnProfile = user?.id === id;

  return (
    <motion.div 
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="max-w-4xl mx-auto space-y-10 py-8 px-4 md:px-0"
    >
      
      {/* --- 1. Profile Hero Section --- */}
      <motion.section variants={fadeUp}>
        {profile.isPending ? (
          <div className="card p-10 flex flex-col items-center justify-center min-h-[250px] gap-4">
             <svg className="w-8 h-8 text-[#a83f08] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-slate-500 font-bold tracking-wide animate-pulse">Loading profile…</p>
          </div>
        ) : profile.isError ? (
          <div className="card p-8 bg-[#fff0ee] shadow-[inset_4px_4px_8px_rgba(163,45,40,0.1)]">
            <ErrorState
              message={profile.error.message}
              retry={() => void profile.refetch()}
            />
          </div>
        ) : profile.data && (
          <div className="card p-8 md:p-10 bg-gradient-to-br from-[#fffbf5] to-[#f7efe5] flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-8">
            
            <div className="shrink-0 relative">
              <ReaderAvatar url={profile.data.avatar_url} name={profile.data.display_name ?? "Reader"} size={120} />
              {profile.data.membership_verified && (
                <div 
                  className="absolute -bottom-2 -right-2 bg-[#27633e] text-white p-2 rounded-full shadow-[4px_4px_8px_rgba(39,99,62,0.3)]"
                  title="Campus Verified"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight">
                  {profile.data.display_name ?? "Reader Profile"}
                </h1>
                {profile.data.campus && (
                  <p className="text-slate-500 font-bold mt-1 flex items-center justify-center md:justify-start gap-2">
                    <svg className="w-4 h-4 text-[#ea6113]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {profile.data.campus.name}
                  </p>
                )}
              </div>

              {profile.data.bio && (
                <p className="text-slate-600 font-medium leading-relaxed max-w-2xl whitespace-pre-wrap break-words">
                  "{profile.data.bio}"
                </p>
              )}

              {!!profile.data.reading_interests.length && (
                <div className="pt-2 flex flex-wrap justify-center md:justify-start gap-2">
                  {profile.data.reading_interests.map((interest, idx) => (
                    <span key={idx} className="px-4 py-1.5 rounded-full text-xs font-bold bg-white text-[#a83f08] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.03),2px_2px_6px_rgba(234,97,19,0.05)] border border-[#ffe3b3]/50">
                      {interest}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            {isOwnProfile && (
              <div className="shrink-0 w-full md:w-auto pt-4 md:pt-0">
                <ButtonLink variant="secondary" href="/my-books" className="button-primary w-full md:w-auto justify-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  Manage Shelf
                </ButtonLink>
              </div>
            )}
          </div>
        )}
      </motion.section>

      {/* --- 2. Reputation Grid --- */}
      <motion.section variants={fadeUp} className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 px-2">
          <svg className="w-5 h-5 text-[#ea6113]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.956 11.956 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          Exchange Reputation
        </h2>
        
        {reputation.isPending ? (
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {[1,2,3,4].map(i => <div key={i} className="h-28 card bg-[#f7efe5] animate-pulse shadow-inner border-none" />)}
           </div>
        ) : reputation.isError ? (
          <div className="card p-6 bg-[#fff0ee]">
            <ErrorState message={reputation.error.message} retry={() => void reputation.refetch()} />
          </div>
        ) : rep && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <div className="card p-5 bg-white flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Rating</span>
                <svg className="w-5 h-5 text-[#fbb931]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-slate-800">
                  {rep.average_rating === null ? "-" : rep.average_rating.toFixed(1)}
                </p>
                <p className="text-xs font-semibold text-slate-400 mt-1">{rep.review_count} reviews</p>
              </div>
            </div>

            <div className="card p-5 bg-white flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Exchanges</span>
                <svg className="w-5 h-5 text-[#27633e]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-slate-800">{rep.completed_exchanges}</p>
                <p className="text-xs font-semibold text-slate-400 mt-1">Completed</p>
              </div>
            </div>

            <div className="card p-5 bg-white flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Partners</span>
                <svg className="w-5 h-5 text-[#24579a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-slate-800">{rep.distinct_exchange_partners}</p>
                <p className="text-xs font-semibold text-slate-400 mt-1">Distinct readers</p>
              </div>
            </div>

            <div className="card p-5 bg-white flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Trust Score</span>
                <svg className="w-5 h-5 text-[#ea6113]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.956 11.956 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-slate-800">
                  {rep.trust_status === "AVAILABLE" && rep.trust_score !== null ? rep.trust_score : "-"}
                </p>
                {rep.trust_status !== "AVAILABLE" && (
                   <p className="text-[10px] font-semibold text-slate-400 mt-1 leading-tight">
                     Needs {rep.minimum_distinct_reviewers} distinct reviewers
                   </p>
                )}
              </div>
            </div>

          </div>
        )}
      </motion.section>

      {/* --- 3. Reader Bookshelf --- */}
      {profile.isSuccess && !isOwnProfile && (
        <motion.div variants={fadeUp}>
          <ReaderBooks id={id} />
        </motion.div>
      )}

      {/* --- 4. Published Reviews --- */}
      <motion.section variants={fadeUp} className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 px-2">
          <svg className="w-5 h-5 text-[#ea6113]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          Published Reviews
        </h2>
        
        {reviews.isPending ? (
          <div className="card p-8 flex justify-center">
            <svg className="w-6 h-6 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
          </div>
        ) : reviews.isError ? (
          <div className="card p-6 bg-[#fff0ee]">
            <ErrorState message={reviews.error.message} retry={() => void reviews.refetch()} />
          </div>
        ) : reviews.data.pages.flatMap((p) => p.items).length === 0 ? (
          <div className="card p-10 text-center bg-[#f7efe5] shadow-inner border-none">
            <div className="w-12 h-12 mx-auto bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
               <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <p className="text-slate-500 font-bold">No published reviews yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.data.pages
              .flatMap((p) => p.items)
              .map((item) => (
                <article className="card p-6 bg-white space-y-3" key={item.id}>
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-slate-700 text-sm">
                      {item.reviewer_name ?? "Reader"}
                    </h3>
                    <div className="flex items-center gap-1 bg-[#fffbf5] px-2 py-1 rounded-full shadow-[inset_1px_1px_3px_rgba(0,0,0,0.05)]">
                      <span className="font-extrabold text-sm text-[#a83f08]">{item.rating}</span>
                      <svg className="w-3.5 h-3.5 text-[#fbb931]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                    </div>
                  </div>
                  <p className="text-slate-600 font-medium text-sm leading-relaxed whitespace-pre-wrap break-words">
                    &quot;{item.comment}&quot;
                  </p>
                </article>
              ))}
          </div>
        )}
        
        {reviews.hasNextPage && (
          <div className="pt-2 flex justify-center">
            <Button
              variant="secondary"
              disabled={reviews.isFetching}
              onClick={() => void reviews.fetchNextPage()}
              className="button-secondary px-8"
            >
              Load Earlier Reviews
            </Button>
          </div>
        )}
      </motion.section>

      {/* --- 5. Safety Actions Footer --- */}
      {!isOwnProfile && (
        <motion.div variants={fadeUp} className="pt-10 mt-10 border-t-2 border-[#e8d7c4]/40">
          <div className="p-6 rounded-[2rem] bg-[#f7efe5] shadow-[inset_4px_4px_8px_rgba(31,22,18,0.03),inset_-4px_-4px_8px_rgba(255,255,255,0.8)]">
            <div className="flex items-center gap-2 mb-4 px-2 text-slate-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              <h3 className="font-bold text-sm uppercase tracking-wider">Trust & Safety</h3>
            </div>
            <SafetyActions userId={id} />
          </div>
        </motion.div>
      )}

    </motion.div>
  );
}