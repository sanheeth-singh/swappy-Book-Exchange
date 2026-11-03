"use client";
import Link from "next/link";
import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { givingAndReceiving } from "@/features/exchanges/policies";
import {
  conversationPage,
  conversationList,
  activeConversation,
  type ConversationCursor,
} from "../conversations";
import { ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
import { motion } from "framer-motion";

export function ConversationInbox({ selectedId }: { selectedId?: string }) {
  const { user } = useAuth();
  const [history, setHistory] = useState(false);
  
  const query = useInfiniteQuery({
    queryKey: ["exchanges", "conversations"],
    initialPageParam: { sent: 0, received: 0 } as ConversationCursor,
    queryFn: ({ pageParam, signal }) => conversationPage(pageParam, signal),
    getNextPageParam: (page) => page.next,
    refetchOnWindowFocus: true,
  });

  const all = conversationList(query.data?.pages ?? [], user!.id);
  const items = all.filter((exchange) =>
    history ? !activeConversation(exchange) : activeConversation(exchange),
  );

  return (
    <aside className="card flex flex-col h-full bg-[#f7efe5] border-none shadow-inset rounded-[2rem] overflow-hidden p-2" aria-label="Exchange conversations">
      
      {/* Sticky Top Controls */}
      <div className="p-4 space-y-4">
        <div className="flex bg-white rounded-full p-1 shadow-[inset_2px_2px_6px_rgba(31,22,18,0.08)]">
          <button
            className={`flex-1 py-2 px-4 rounded-full text-sm font-bold transition-all ${!history ? 'bg-[#ffe3b3] text-[#a83f08] shadow-[4px_4px_8px_rgba(234,97,19,0.1),-4px_-4px_8px_rgba(255,255,255,0.9)]' : 'text-slate-500 hover:text-slate-700'}`}
            aria-pressed={!history}
            onClick={() => setHistory(false)}
          >
            Active
          </button>
          <button
            className={`flex-1 py-2 px-4 rounded-full text-sm font-bold transition-all ${history ? 'bg-[#ffe3b3] text-[#a83f08] shadow-[4px_4px_8px_rgba(234,97,19,0.1),-4px_-4px_8px_rgba(255,255,255,0.9)]' : 'text-slate-500 hover:text-slate-700'}`}
            aria-pressed={history}
            onClick={() => setHistory(true)}
          >
            History
          </button>
        </div>
      </div>

      {/* Scrollable List */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none]">
        {query.isPending ? (
          <div className="flex justify-center p-6">
            <svg className="w-6 h-6 text-[#ea6113] animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
          </div>
        ) : query.isError ? (
          <div className="p-4 bg-[#fff0ee] rounded-2xl">
            <ErrorState message={query.error.message} retry={() => void query.refetch()} />
          </div>
        ) : (
          <nav className="flex flex-col gap-3">
            {items.map((exchange) => {
              const books = givingAndReceiving(exchange, user!.id);
              const isSelected = selectedId === exchange.id;
              
              return (
                <Link
                  key={exchange.id}
                  className={`block p-4 rounded-2xl transition-all ${isSelected ? 'bg-white shadow-[6px_6px_12px_rgba(31,22,18,0.06),-6px_-6px_12px_rgba(255,255,255,0.9)] border border-white' : 'bg-[#fffbf5] shadow-[inset_2px_2px_4px_rgba(255,255,255,0.8),inset_-2px_-2px_4px_rgba(31,22,18,0.04)] hover:bg-white'}`}
                  href={`/messages/${exchange.id}`}
                  aria-current={isSelected ? "page" : undefined}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className={`font-bold truncate ${isSelected ? 'text-[#a83f08]' : 'text-slate-700'}`}>
                      {exchange.requester_id === user!.id ? exchange.owner_name : exchange.requester_name}
                    </h3>
                    {/* Simplified Status Indicator instead of heavy badge */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`w-2 h-2 rounded-full ${exchange.status === 'ACCEPTED' ? 'bg-[#27633e]' : 'bg-[#ea6113]'}`} />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        {exchange.status === 'ACCEPTED' ? 'Active' : 'Closed'}
                      </span>
                    </div>
                  </div>
                  <p className="line-clamp-1 text-sm font-semibold text-slate-800">
                    {books.receiving.title}
                  </p>
                  <p className="line-clamp-1 text-xs font-medium text-slate-500 mt-1">
                    Offering: {books.giving.title}
                  </p>
                </Link>
              );
            })}
          </nav>
        )}

        {!items.length && !query.isError && !query.isPending && (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#e6eaf0] flex items-center justify-center shadow-inner text-slate-400">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <p className="text-sm font-medium text-slate-500">
              {history ? "No closed conversations yet." : "No active accepted exchanges yet."}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}