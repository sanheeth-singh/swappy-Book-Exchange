"use client";
import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { chatApi, createAttempt, mergeMessages, type SendAttempt } from "../api";
import { FormError } from "@/components/feedback/form-error";
import { ErrorState } from "@/components/feedback/error-state";
import { motion } from "framer-motion";

export function ChatPanel({
  id,
  active,
  embedded = false,
}: {
  id: string;
  active: boolean;
  embedded?: boolean;
}) {
  const list = useRef<HTMLOListElement>(null);
  const nearBottom = useRef(true);
  const olderPosition = useRef<{ height: number; top: number } | undefined>(undefined);
  
  const { user } = useAuth();
  const client = useQueryClient();
  const [draft, setDraft] = useState("");
  const [attempt, setAttempt] = useState<SendAttempt>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const query = useInfiniteQuery({
    queryKey: ["chat", id],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) => chatApi.messages(id, pageParam),
    getNextPageParam: (page) => page.next_before ?? undefined,
    refetchInterval: active ? 5000 : false,
  });

  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["chat", id] }),
      client.invalidateQueries({ queryKey: ["notifications"] }),
    ]);
  }

  async function send(value: SendAttempt) {
    if (pending) return;
    setPending(true);
    setError(undefined);
    setAttempt(value);
    try {
      await chatApi.send(id, value);
      setAttempt(undefined);
      setDraft("");
      await refresh();
      // Auto-scroll to bottom on send
      if (list.current) list.current.scrollTop = list.current.scrollHeight;
    } catch (failure) {
      setError(`Delivery failed. ${failure instanceof Error ? failure.message : "Try again."}`);
    } finally {
      setPending(false);
    }
  }

  const messages = mergeMessages(query.data?.pages ?? []);
  const latest = query.data?.pages[0];
  const lastId = messages.at(-1)?.id;

  useEffect(() => {
    const node = list.current;
    if (!node) return;
    if (olderPosition.current) {
      node.scrollTop = node.scrollHeight - olderPosition.current.height + olderPosition.current.top;
      olderPosition.current = undefined;
    } else if (nearBottom.current) {
      node.scrollTop = node.scrollHeight;
    }
  }, [lastId, messages.length, query.isError]);

  // Message Grouping Tracking Logic
  let previousSender: string | null = null;
  let previousTime: number | null = null;

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden relative bg-[#fffbf5]">
      
      {query.isPending ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <svg className="w-8 h-8 text-[#ea6113] animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
        </div>
      ) : query.isError ? (
        <div className="p-6">
          <ErrorState message={query.error.message} retry={() => void query.refetch()} />
        </div>
      ) : (
        <>
          {/* Top Pagination Control */}
          {query.hasNextPage && (
            <div className="absolute top-4 left-0 right-0 flex justify-center z-10 pointer-events-none">
              <button
                className="pointer-events-auto px-6 py-2 rounded-full bg-white shadow-clay text-sm font-bold text-[#ea6113] hover:scale-105 transition-transform"
                disabled={query.isFetching}
                onClick={() => {
                  if (list.current) {
                    olderPosition.current = { height: list.current.scrollHeight, top: list.current.scrollTop };
                  }
                  void query.fetchNextPage().then((res) => { if (res.isError) olderPosition.current = undefined; });
                }}
              >
                {query.isFetching ? 'Loading...' : 'Load Earlier'}
              </button>
            </div>
          )}

          {/* Chat Feed Scroll Area */}
          <ol
            ref={list}
            onScroll={() => {
              const node = list.current;
              if (node) nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
            }}
            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 scroll-smooth"
            aria-label="Conversation messages"
          >
            {!messages.length && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                <svg className="w-12 h-12 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                <p className="text-slate-500 font-bold">It's quiet here. Say hello!</p>
              </div>
            )}
            
            {messages.map((message) => {
              const isMine = message.sender_id === user?.id;
              const msgTime = new Date(message.created_at).getTime();
              
              // Grouping Logic: If same sender within 5 minutes, hide header block
              const isNewGroup = previousSender !== message.sender_id || (previousTime && (msgTime - previousTime > 300000));
              
              // eslint-disable-next-line react-hooks/immutability
              previousSender = message.sender_id;
              previousTime = msgTime;

              return (
                <li key={message.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"} ${isNewGroup ? 'mt-6' : 'mt-1'}`}>
                  
                  {isNewGroup && (
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-2">
                      {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  
                  <div 
                    className={`max-w-[85%] md:max-w-[70%] px-4 py-3 leading-relaxed shadow-clay ${
                      isMine 
                        ? 'bg-[#ffe3b3] text-[#873206] rounded-[1.5rem] rounded-tr-md' 
                        : 'bg-white text-slate-700 rounded-[1.5rem] rounded-tl-md'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  </div>
                  
                  {/* Read Receipt (Only on last grouped message if applicable) */}
                  {isMine && message.sequence <= (latest?.other_read.sequence ?? 0) && (
                    <span className="text-[10px] font-bold text-slate-400 mt-1 px-2">Read</span>
                  )}
                </li>
              );
            })}
          </ol>

          {/* Read Marker Control (Hidden if no messages) */}
          {messages.length > 0 && active && (
            <div className="px-4 pb-2 flex justify-end">
              <button
                className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-[#ea6113] transition-colors"
                disabled={pending}
                onClick={async () => {
                  try {
                    await chatApi.read(id, messages[messages.length - 1].id);
                    await refresh();
                  } catch(e){}
                }}
              >
                Mark as Read
              </button>
            </div>
          )}

          {/* Sticky Composer */}
          <div className="p-4 bg-[#f7efe5] border-t-2 border-white/50 shrink-0">
            {!latest?.can_send ? (
              <div className="p-4 bg-white/50 rounded-2xl text-center">
                <p className="text-sm font-bold text-slate-500">Conversation is closed.</p>
              </div>
            ) : (
              <form
                className="flex items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!attempt && draft.trim()) void send(createAttempt(draft));
                }}
              >
                <div className="flex-1 bg-white rounded-3xl shadow-inset p-2 flex items-center">
                  <textarea
                    id={`message-${id}`}
                    className="w-full bg-transparent border-none focus:ring-0 resize-none px-4 py-2 text-base text-slate-800 placeholder-slate-400 max-h-32"
                    placeholder="Type a message..."
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={2000}
                    rows={1}
                    required
                    disabled={pending || !!attempt}
                    onKeyDown={(e) => {
                      // Allow enter to send on desktop, shift+enter for new line
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!attempt && draft.trim()) void send(createAttempt(draft));
                      }
                    }}
                  />
                </div>

                {attempt ? (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button type="button" onClick={() => void send(attempt)} className="p-3 bg-[#ffe3b3] text-[#a83f08] rounded-full shadow-clay" title="Retry">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                    <button type="button" onClick={() => { setAttempt(undefined); setDraft(""); }} className="p-3 bg-[#fff0ee] text-[#a32d28] rounded-full shadow-clay" title="Discard">
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ) : (
                  <button
                    type="submit"
                    className="w-14 h-14 shrink-0 rounded-full bg-gradient-to-br from-[#ea6113] to-[#a83f08] text-white shadow-[6px_6px_12px_rgba(234,97,19,0.25),-4px_-4px_10px_rgba(255,255,255,0.8)] flex items-center justify-center disabled:opacity-50 transition-transform active:scale-95"
                    disabled={pending || !draft.trim()}
                    aria-label="Send Message"
                  >
                    {pending ? (
                      <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                    ) : (
                      <svg className="w-6 h-6 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    )}
                  </button>
                )}
              </form>
            )}
          </div>
        </>
      )}
      <div className="px-4 pb-2"><FormError message={error} /></div>
    </div>
  );
}