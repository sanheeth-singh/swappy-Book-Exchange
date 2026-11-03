"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/features/auth/auth-provider";
import { profileSchema } from "@/features/auth/schemas";
import { getCampuses, saveProfile } from "../api";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormError } from "@/components/feedback/form-error";
import { ErrorState } from "@/components/feedback/error-state";
import { useOverlayStore } from "@/stores/overlay-store";
import { useToastStore } from "@/stores/toast-store";
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

export function ProfileScreen() {
  const { user } = useAuth();
  return user ? <ProfileForm key={user.id + (user.campus_id ?? "")} /> : null;
}

function ProfileForm() {
  const auth = useAuth();
  const user = auth.user!;
  const client = useQueryClient();
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string>();

  const directory = useQuery({
    queryKey: ["campuses", q, offset],
    queryFn: () => getCampuses(q, offset),
  });

  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: user.display_name ?? "",
      campus_id: user.campus_id ?? "",
    },
  });

  const selectedCampus = useWatch({ control: form.control, name: "campus_id" });

  async function save(data: { display_name: string; campus_id: string }) {
    setError(undefined);
    try {
      const updated = await saveProfile(data);
      client.setQueryData(["auth", "me"], updated);
      await client.invalidateQueries({ queryKey: ["membership"] });
      useToastStore.getState().show("Profile saved.");
    } catch (failure) {
      const message =
        failure instanceof Error
          ? failure.message
          : "Profile could not be saved.";
      setError(message);
      throw failure;
    }
  }

  const submit = form.handleSubmit(async (data) => {
    if (user.campus_id && data.campus_id !== user.campus_id) {
      useOverlayStore.getState().openConfirmation({
        title: "Change your campus?",
        description:
          "This resets your verification, archives your listings and withdraws pending proposals. Unresolved accepted exchanges must be resolved first.",
        confirmLabel: "Change campus",
        destructive: true,
        onConfirm: () => save(data),
      });
    } else {
      try {
        await save(data);
      } catch {}
    }
  });

  return (
    <motion.div 
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="max-w-4xl mx-auto space-y-8 py-6 px-4 md:px-0"
    >
      {/* Header Section */}
      <motion.header variants={fadeUp} className="space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#f7efe5] shadow-[inset_2px_2px_4px_rgba(31,22,18,0.05)] text-[#a83f08] font-bold text-xs uppercase tracking-widest">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Campus Identity
        </div>
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 tracking-tight">Set up your profile.</h1>
          <div className="flex items-center gap-2 mt-3 text-lg font-medium text-slate-500">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {user.email}
          </div>
        </div>
      </motion.header>

      {/* Horizontal Scroll Navigation for Secondary Actions */}
      <motion.nav variants={fadeUp} className="relative w-full -mx-4 px-4 md:mx-0 md:px-0">
        {/* Mobile Fade Mask - Tells users they can scroll horizontally */}
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#fffbf5] to-transparent pointer-events-none z-10 md:hidden" />
        
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <ButtonLink variant="secondary" href="/settings/profile" className="snap-start shrink-0">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Reader details
          </ButtonLink>
          <ButtonLink variant="secondary" href="/settings/account" className="snap-start shrink-0">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Account settings
          </ButtonLink>
          <ButtonLink variant="secondary" href="/notifications" className="snap-start shrink-0">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            Notifications
          </ButtonLink>
          <ButtonLink variant="secondary" href="/safety" className="snap-start shrink-0">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            Safety
          </ButtonLink>
          
          <ButtonLink variant="secondary" href={`/readers/${user.id}`} className="snap-start shrink-0">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.956 11.956 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            My reputation
          </ButtonLink>
        </div>
      </motion.nav>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <motion.div variants={fadeUp} className="md:col-span-8 space-y-6">
          
          {/* Highlighted Banner for Verification */}
          <div className="p-6 rounded-[2rem] bg-gradient-to-r from-[#ffe3b3] to-[#f7efe5] shadow-[inset_4px_4px_8px_rgba(255,255,255,0.9),inset_-4px_-4px_8px_rgba(234,97,19,0.1)] flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#a83f08]">Campus Verification</h2>
              <p className="text-sm font-medium text-slate-600 mt-1">Unlock exchanges by verifying your student status.</p>
            </div>
            <ButtonLink href="/membership" className="button-primary w-full md:w-auto shrink-0 shadow-none">
              Verify Now
            </ButtonLink>
          </div>

          <Card className="p-6 md:p-8">
            <form className="space-y-8" onSubmit={submit}>
              
              {/* Display Name Section */}
              <div className="space-y-3">
                <label htmlFor="name" className="font-bold text-slate-700 ml-1 text-sm tracking-wide">DISPLAY NAME</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                  <Input
                    id="name"
                    maxLength={80}
                    placeholder="How others will see you"
                    className="field pl-12 text-lg"
                    {...form.register("display_name")}
                  />
                </div>
                <FormError message={form.formState.errors.display_name?.message} />
              </div>

              <hr className="border-t-2 border-[#f7efe5]" />

              {/* Grouped Campus Selection */}
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-6 h-6 text-[#ea6113]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  Campus Selection
                </h2>
                
                <div className="p-6 rounded-[2rem] bg-[#f7efe5] shadow-[inset_6px_6px_12px_rgba(31,22,18,0.06),inset_-6px_-6px_12px_rgba(255,255,255,0.9)] space-y-6">
                  
                  <div className="space-y-2">
                    <label htmlFor="campus-search" className="font-bold text-slate-700 ml-1 text-xs tracking-wide">SEARCH DIRECTORY</label>
                    <div className="relative flex items-center">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      </div>
                      <Input
                        id="campus-search"
                        type="search"
                        placeholder="College, campus or city..."
                        className="field pl-12 bg-white"
                        onChange={(event) => {
                          setQ(event.target.value);
                          setOffset(0);
                        }}
                        value={q}
                      />
                    </div>
                  </div>

                  {directory.isError ? (
                    <div className="p-4 rounded-2xl bg-[#fff0ee] text-[#a32d28] shadow-[inset_2px_3px_6px_rgba(163,45,40,0.1)]">
                      <ErrorState
                        message={directory.error.message}
                        retry={() => {
                          void directory.refetch();
                        }}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label htmlFor="campus" className="font-bold text-slate-700 ml-1 text-xs tracking-wide">SELECT MATCH</label>
                        <Select
                          id="campus"
                          className="field bg-white"
                          {...form.register("campus_id")}
                          value={selectedCampus}
                          disabled={directory.isPending}
                        >
                          <option value="">
                            {directory.isPending
                              ? "Loading campuses…"
                              : "Choose a campus from results"}
                          </option>
                          {selectedCampus &&
                            !directory.data?.some(
                              (campus) => campus.id === selectedCampus,
                            ) && (
                              <option value={selectedCampus}>
                                {selectedCampus === user.campus_id
                                  ? "Keep current campus"
                                  : "Selected campus (outside these search results)"}
                              </option>
                            )}
                          {directory.data?.map((campus) => (
                            <option key={campus.id} value={campus.id}>
                              {campus.college_name} · {campus.name} · {campus.city}
                            </option>
                          ))}
                        </Select>
                        <FormError message={form.formState.errors.campus_id?.message} />
                      </div>
                      
                      {directory.data?.length === 0 && (
                        <div className="flex items-start gap-3 p-4 rounded-2xl bg-white shadow-inner">
                          <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          <p className="text-sm font-medium text-slate-600">
                            No active campus found. Try another search or contact your campus administrator.
                          </p>
                        </div>
                      )}
                      
                      {/* Pagination Controls */}
                      <div className="flex justify-between items-center pt-2">
                        <Button
                          variant="ghost"
                          type="button"
                          disabled={!offset}
                          onClick={() => setOffset(Math.max(0, offset - 50))}
                          className="px-4 text-sm"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                          Previous
                        </Button>
                        <Button
                          variant="ghost"
                          type="button"
                          disabled={directory.data?.length !== 50}
                          onClick={() => setOffset(offset + 50)}
                          className="px-4 text-sm"
                        >
                          Next
                          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <FormError message={error} />
              
              <div className="pt-6 border-t-2 border-[#e8d7c4]/30">
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting || directory.isPending}
                  className="button-primary w-full md:w-auto px-10 py-4 text-lg"
                >
                  {form.formState.isSubmitting ? (
                    <>
                      <svg className="w-5 h-5 mr-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving Changes…
                    </>
                  ) : (
                    <>
                      Save Profile
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}