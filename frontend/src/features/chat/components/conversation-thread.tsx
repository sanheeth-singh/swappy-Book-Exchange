"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { exchangesApi, exchangeKeys } from "@/features/exchanges/api";
import { ExchangeActionBar } from "@/features/exchanges/components/exchange-action-bar";
import { ExchangeSummary } from "@/features/exchanges/components/exchange-summary";
import { SafetyActions } from "@/features/blocking/components/safety-actions";
import { canOpenConversation, activeConversation } from "../conversations";
import { ChatPanel } from "./chat-panel";
import { ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export function ConversationThread({ id }: { id: string }) {
  const { user } = useAuth();
  const [showDetails, setShowDetails] = useState(false);

  const query = useQuery({
    queryKey: exchangeKeys.detail(id),
    queryFn: ({ signal }) => exchangesApi.detail(id, signal),
    refetchInterval: 15000,
  });

  if (query.isPending) {
    return (
      <div className="card flex-1 p-8 flex items-center justify-center bg-white border-none shadow-clay rounded-[2rem]">
        <svg className="w-8 h-8 text-[#ea6113] animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="card flex-1 p-8 bg-[#fff0ee] rounded-[2rem] border-none shadow-clay">
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      </div>
    );
  }

  const exchange = query.data;

  if (!canOpenConversation(exchange, user!.id)) {
    return (
      <div className="card flex-1 p-10 flex flex-col items-center justify-center text-center bg-[#f7efe5] border-none shadow-inset rounded-[2rem]">
        <div className="w-20 h-20 mb-6 rounded-full bg-white flex items-center justify-center shadow-[6px_6px_12px_rgba(31,22,18,0.06),-6px_-6px_12px_rgba(255,255,255,0.9)] text-[#a83f08]">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Chat Locked</h2>
        <p className="mt-2 text-slate-500 font-medium mb-6">Conversations open only after the exchange is formally accepted.</p>
        <ButtonLink variant="secondary" className="button-primary px-8" href={`/exchanges/${id}`}>
          View Exchange Details
        </ButtonLink>
      </div>
    );
  }

  const requester = exchange.requester_id === user!.id;
  const otherName = requester ? exchange.owner_name : exchange.requester_name;
  const otherId = requester ? exchange.owner_id : exchange.requester_id;
  const isActive = activeConversation(exchange);

  return (
    <div className="card flex flex-col flex-1 h-full bg-white border-none shadow-clay rounded-[2rem] overflow-hidden relative">
      
      {/* Compact Chat Header */}
      <header className="flex items-center justify-between p-4 bg-white shadow-[0_4px_12px_rgba(31,22,18,0.04)] z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/messages" className="md:hidden w-10 h-10 rounded-full bg-[#f7efe5] flex items-center justify-center text-slate-600 shadow-inner">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <div className="w-10 h-10 rounded-full bg-[#ffe3b3] flex items-center justify-center shadow-inset shrink-0 text-[#a83f08] font-bold">
             {otherName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 leading-tight">{otherName}</h2>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-[#27633e]' : 'text-[#a32d28]'}`}>
              {isActive ? 'Active Handover' : 'Closed Exchange'}
            </span>
          </div>
        </div>
        
        <button 
          onClick={() => setShowDetails(true)}
          className="w-10 h-10 rounded-full bg-[#fffbf5] flex items-center justify-center text-slate-500 hover:text-[#ea6113] shadow-[4px_4px_8px_rgba(31,22,18,0.06),-4px_-4px_8px_rgba(255,255,255,0.9)] active:shadow-inset transition-all shrink-0"
          aria-label="View Details"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </button>
      </header>

      {/* Slide-out Details Sheet Overlay */}
      <AnimatePresence>
        {showDetails && (
          <motion.div 
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-50 bg-[#f7efe5] flex flex-col"
          >
            <div className="flex items-center justify-between p-6 bg-white shadow-[0_4px_12px_rgba(31,22,18,0.04)] shrink-0">
              <h3 className="text-xl font-bold text-slate-800">Exchange Details</h3>
              <button onClick={() => setShowDetails(false)} className="w-10 h-10 rounded-full bg-[#fffbf5] flex items-center justify-center text-slate-500 hover:text-[#a32d28] shadow-[4px_4px_8px_rgba(31,22,18,0.06),-4px_-4px_8px_rgba(255,255,255,0.9)] active:shadow-inset">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="p-5 rounded-2xl bg-white shadow-clay space-y-4">
                <p className="text-sm font-semibold text-slate-600 leading-relaxed">
                  {isActive
                    ? "Confirm receipt only after the physical handover is complete. Never share passwords or payment details."
                    : "This exchange is closed. Conversation history remains read-only."}
                </p>
                <ExchangeActionBar exchange={exchange} />
              </div>

              <div className="p-5 rounded-2xl bg-white shadow-clay space-y-4">
                <h4 className="font-bold text-sm text-slate-500 uppercase tracking-wider">Books in Exchange</h4>
                <ExchangeSummary exchange={exchange} userId={user!.id} />
              </div>

              <div className="p-5 rounded-2xl bg-[#fff0ee] shadow-inner space-y-4">
                <h4 className="font-bold text-sm text-[#a32d28] uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  Support & Safety
                </h4>
                <div className="space-y-3">
                  <ButtonLink variant="secondary" className="w-full bg-white justify-center text-sm" href={`/readers/${otherId}`}>
                    View Reader Profile
                  </ButtonLink>
                  {isActive && (
                    <ButtonLink variant="ghost" className="w-full justify-center text-sm text-[#a83f08]" href={`/exchanges/${id}#handover-issue`}>
                      Report Handover Issue
                    </ButtonLink>
                  )}
                  <SafetyActions userId={otherId} />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The Actual Chat Feed */}
      <ChatPanel key={id} id={id} active={isActive} embedded />
    </div>
  );
}