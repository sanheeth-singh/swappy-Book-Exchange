"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { getMembership, submitProof } from "../api";
import { protectedRequest } from "@/features/auth/session";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ImagePicker } from "@/components/ui/image-picker";
import { FormError } from "@/components/feedback/form-error";
import { ErrorState } from "@/components/feedback/error-state";
import { Badge } from "@/components/ui/badge";
import { membershipStatuses } from "@/features/help/content";
import { validateProof } from "../validation";
import { motion, AnimatePresence } from "framer-motion";
import { BookMarked } from "lucide-react";

// --- Animation Variants ---
const fadeUp = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function MembershipScreen() {
  const { user } = useAuth();
  const complete = !!user?.display_name && !!user.campus_id;
  
  const query = useQuery({
    queryKey: ["membership", user?.id],
    queryFn: getMembership,
    enabled: complete,
    retry: false,
  });

  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [isChecking, setIsChecking] = useState(false);

  async function upload(file: File) {
    setNotice(undefined);
    await submitProof(file);
    await query.refetch();
    setNotice("Proof submitted successfully. Our team will review it shortly.");
  }

  async function check() {
    setIsChecking(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await protectedRequest({ url: "/membership/eligibility" });
      setNotice(
        "Your campus verification is currently eligible. Other account rules may still apply."
      );
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Eligibility unavailable."
      );
    } finally {
      setIsChecking(false);
    }
  }

  const membership = query.data;
  const expired = membership?.expires_at
    ? new Date(membership.expires_at).getTime() <= query.dataUpdatedAt
    : false;
    
  const canSubmit =
    membership?.active &&
    membership.status !== "PENDING" &&
    membership.status !== "REVOKED" &&
    (membership.status !== "VERIFIED" || expired);

  // Helper to determine status styling
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return { 
          bg: 'from-[#e6f5f2] to-[#fffbf5]', 
          iconColor: 'text-[#17635f]',
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        };
      case 'PENDING':
        return { 
          bg: 'from-[#fff4d4] to-[#fffbf5]', 
          iconColor: 'text-[#805000]',
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        };
      case 'REVOKED':
        return { 
          bg: 'from-[#fff0ee] to-[#fffbf5]', 
          iconColor: 'text-[#a32d28]',
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        };
      default:
        return { 
          bg: 'from-[#f7efe5] to-[#fffbf5]', 
          iconColor: 'text-[#6f5d52]',
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        };
    }
  };

  const statusConfig = membership ? getStatusConfig(membership.status) : null;

  return (
    <motion.div 
      initial="hidden" 
      animate="show" 
      variants={{ show: { transition: { staggerChildren: 0.1 } } }}
      className="max-w-3xl mx-auto space-y-8 py-8 px-4 md:px-0"
    >
      {/* Header Section */}
      <motion.header variants={fadeUp} className="space-y-4 text-center md:text-left">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#f7efe5] shadow-[inset_2px_2px_4px_rgba(31,22,18,0.05)] text-[#a83f08] font-bold text-xs uppercase tracking-widest mb-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.956 11.956 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Campus Verification
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 tracking-tight">Ready to take part?</h1>
        <p className="text-lg text-slate-500 font-medium max-w-2xl mx-auto md:mx-0">
          Submit enrollment proof for manual review to unlock book listings and exchange proposals.
        </p>
      </motion.header>

      {/* Main Content Area */}
      <motion.div variants={fadeUp}>
        {!complete ? (
          <Card className="p-10 text-center flex flex-col items-center justify-center space-y-6 bg-gradient-to-br from-[#fffbf5] to-[#f7efe5]">
            <div className="w-16 h-16 rounded-full bg-[#ffe3b3] shadow-[inset_4px_4px_8px_rgba(255,255,255,0.9),inset_-4px_-4px_8px_rgba(234,97,19,0.1)] flex items-center justify-center">
              <svg className="w-8 h-8 text-[#a83f08]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-800">Profile Incomplete</h2>
              <p className="text-slate-500 font-medium">Please set up your display name and campus before verifying.</p>
            </div>
            <ButtonLink href="/profile" className="button-primary px-8 py-3">
              Complete Profile Now
            </ButtonLink>
          </Card>
        ) : query.isPending ? (
          <Card className="p-12 flex flex-col justify-center items-center min-h-[250px] gap-4">
            <svg className="w-8 h-8 text-[#a83f08] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-slate-500 font-bold tracking-wide animate-pulse">Loading membership status…</p>
          </Card>
        ) : query.isError ? (
          <Card className="p-8 bg-[#fff0ee] shadow-[inset_4px_4px_8px_rgba(163,45,40,0.1)]">
            <ErrorState
              message={query.error.message}
              retry={() => {
                void query.refetch();
              }}
            />
          </Card>
        ) : (
          membership && statusConfig && (
            <div className="space-y-8">
              
              {/* Dynamic Status Dashboard Card */}
              <Card className={`p-8 bg-gradient-to-br ${statusConfig.bg} shadow-[8px_8px_16px_rgba(163,177,198,0.06),-8px_-8px_16px_rgba(255,255,255,0.8)] border-none`}>
                <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 mt-1">
                      <svg className={`w-8 h-8 ${statusConfig.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {statusConfig.icon}
                      </svg>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Current Status</p>
                        <Badge className={`text-sm px-4 py-1.5 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05)]`}>
                          {membership.status in membershipStatuses
                            ? membershipStatuses[membership.status as keyof typeof membershipStatuses].label
                            : membership.status}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1">
                        {membership.expires_at && (
                          <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            Expires: {new Date(membership.expires_at).toLocaleDateString()}
                          </p>
                        )}
                        {membership.review_reason && (
                          <p className="text-sm font-semibold text-[#a32d28] flex items-start gap-2 max-w-md">
                            {/* <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> */}
                            <BookMarked className="w-5 h-5"/>
                            {membership.review_reason}
                          </p>
                        )}
                        {!membership.active && (
                          <p className="text-sm font-semibold text-slate-600 flex items-start gap-2">
                            <svg className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            Account is inactive. Please contact administration.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions Restructured for Hierarchy */}
                  <div className="flex flex-row md:flex-col gap-3 pt-4 md:pt-0 border-t-2 md:border-t-0 md:border-l-2 border-[#e8d7c4]/30 md:pl-6 w-full md:w-auto">
                    <Button 
                      variant="secondary" 
                      onClick={check}
                      disabled={isChecking}
                      className="button-secondary flex-1 md:flex-none justify-center"
                    >
                      {isChecking ? "Checking…" : "Check Eligibility"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => void query.refetch()}
                      className="text-slate-500 hover:text-slate-800 shrink-0 px-3 md:w-full md:justify-center"
                      aria-label="Refresh status"
                    >
                      <svg className="w-4 h-4 md:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      <span className="hidden md:inline">Refresh</span>
                    </Button>
                  </div>
                </div>

                {/* Inline Notice/Error for Dashboard Actions */}
                <AnimatePresence>
                  {(notice || error) && !canSubmit && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-6 overflow-hidden"
                    >
                      {error ? <FormError message={error} /> : (
                        <div className="flex items-center gap-3 p-4 bg-white/50 backdrop-blur-sm rounded-2xl shadow-[inset_2px_3px_6px_rgba(31,22,18,0.04)] font-semibold text-sm text-slate-700">
                          <svg className="w-5 h-5 text-[#27633e]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {notice}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>

              {/* Upload Action Zone */}
              {canSubmit && (
                <Card className="p-8 border-2 border-dashed border-[#e8d7c4] bg-[#faf6f0] shadow-none">
                  <div className="mb-6 space-y-2">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <svg className="w-5 h-5 text-[#ea6113]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      Upload Documentation
                    </h3>
                    <p className="text-sm font-medium text-slate-500">
                      Please provide a clear image of your College ID or enrollment proof.
                    </p>
                  </div>

                  <div className="bg-white rounded-3xl p-6 shadow-[inset_4px_4px_8px_rgba(31,22,18,0.04)]">
                    <ImagePicker
                      accept="image/jpeg,image/png"
                      validate={validateProof}
                      onUpload={upload}
                      label="Select an image file..."
                      uploadLabel="Submit for Review"
                    />
                  </div>
                  
                  <div className="mt-6 flex items-start gap-3 p-4 bg-[#f7efe5] rounded-2xl">
                    <svg className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                      Accepts JPEG or PNG, up to 5 MiB. Your proof is securely stored, visible only to authorized reviewers, and permanently deleted after processing.
                    </p>
                  </div>

                  {/* Inline Notice for Upload Actions */}
                  <AnimatePresence>
                    {(notice || error) && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mt-6"
                      >
                        {error ? <FormError message={error} /> : (
                          <div className="flex items-center gap-3 p-4 bg-[#edf7ee] text-[#27633e] rounded-2xl shadow-[inset_2px_3px_6px_rgba(31,22,18,0.06)] font-bold text-sm">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            {notice}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              )}
            </div>
          )
        )}
      </motion.div>

      {/* Footer Helper Link */}
      <motion.div variants={fadeUp} className="pt-6 text-center md:text-left border-t-2 border-[#e8d7c4]/30">
        <ButtonLink href="/help#membership" variant="ghost" className="text-slate-500 hover:text-[#a83f08] font-bold">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Read the verification guide
        </ButtonLink>
      </motion.div>
    </motion.div>
  );
}