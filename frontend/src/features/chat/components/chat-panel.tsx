"use client";
import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import {
  chatApi,
  createAttempt,
  mergeMessages,
  type SendAttempt,
} from "../api";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/feedback/form-error";
import { ErrorState } from "@/components/feedback/error-state";

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
  const olderPosition = useRef<{ height: number; top: number } | undefined>(
    undefined,
  );
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
    } catch (failure) {
      setError(
        `Delivery unconfirmed. ${failure instanceof Error ? failure.message : "Try again."}`,
      );
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
      node.scrollTop =
        node.scrollHeight -
        olderPosition.current.height +
        olderPosition.current.top;
      olderPosition.current = undefined;
    } else if (nearBottom.current) node.scrollTop = node.scrollHeight;
  }, [lastId, messages.length, query.isError]);

  return (
    <section className={`clay-card flex flex-col ${embedded ? "p-6 md:p-8" : "p-8 w-full max-w-4xl mx-auto"}`}>
      <header className="mb-6">
        <h2 className={embedded ? "sr-only" : "text-3xl font-bold text-slate-800"}>
          Exchange conversation
        </h2>
        <p className={embedded ? "sr-only" : "mt-2 text-sm text-slate-500 font-medium"}>
          Arrange a public meeting place and confirm receipt only after the
          physical handover. Never share passwords or payment details.
        </p>
      </header>

      {query.isPending ? (
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <p role="status" className="text-slate-500 animate-pulse font-medium">Loading conversation…</p>
        </div>
      ) : query.isError ? (
        <ErrorState
          message={query.error.message}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <div className="flex flex-col flex-1 h-full">
          {/* Controls */}
          <div className="flex flex-wrap gap-3 mb-6">
            {query.hasNextPage && (
              <button
                className="clay-btn px-4 py-2 text-sm text-slate-700"
                disabled={query.isFetching}
                onClick={() => {
                  if (list.current)
                    olderPosition.current = {
                      height: list.current.scrollHeight,
                      top: list.current.scrollTop,
                    };
                  void query.fetchNextPage().then((result) => {
                    if (result.isError) olderPosition.current = undefined;
                  });
                }}
              >
                Earlier messages
              </button>
            )}
            <button
              className="clay-btn px-4 py-2 text-sm text-slate-700"
              onClick={() => void query.refetch()}
            >
              Refresh
            </button>
            <button
              className="clay-btn px-4 py-2 text-sm text-slate-700"
              onClick={() => {
                nearBottom.current = true;
                if (list.current) list.current.scrollTop = list.current.scrollHeight;
              }}
            >
              Bottom
            </button>
          </div>

          {/* Chat Feed */}
          <div className="clay-input flex-1 overflow-hidden p-2 mb-6">
            <ol
              ref={list}
              onScroll={() => {
                const node = list.current;
                if (node)
                  nearBottom.current =
                    node.scrollHeight - node.scrollTop - node.clientHeight < 48;
              }}
              tabIndex={0}
              className="h-[500px] overflow-y-auto p-4 space-y-6 scroll-smooth"
              aria-label="Conversation messages"
            >
              {!messages.length && (
                <div className="h-full flex items-center justify-center">
                  <p className="text-slate-400 font-medium">No messages yet. Say hello!</p>
                </div>
              )}
              {messages.map((message) => {
                const isMine = message.sender_id === user?.id;
                return (
                  <li
                    key={message.id}
                    className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                    data-mine={isMine}
                  >
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
                      {isMine ? "You" : "Other participant"} ·{" "}
                      {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <div className={`max-w-[85%] md:max-w-[70%] ${isMine ? 'clay-bubble-mine' : 'clay-bubble-other'}`}>
                      <p className="whitespace-pre-wrap break-words leading-relaxed">
                        {message.body}
                      </p>
                    </div>
                    {isMine &&
                      message.sequence <= (latest?.other_read.sequence ?? 0) && (
                        <p className="mt-2 px-2 text-xs font-medium text-slate-400">Read</p>
                      )}
                  </li>
                );
              })}
            </ol>
          </div>

          {messages.length > 0 && (
            <div className="flex justify-end mb-4">
               <button
                className="clay-btn px-4 py-2 text-sm text-slate-600"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  setError(undefined);
                  try {
                    await chatApi.read(id, messages[messages.length - 1].id);
                    await refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Could not update read position.");
                  } finally {
                    setPending(false);
                  }
                }}
              >
                Mark conversation read
              </button>
            </div>
          )}

          {!latest?.can_send && (
            <div className="p-4 mb-6 rounded-xl bg-amber-50 text-amber-700 shadow-inner">
              <p className="text-sm font-medium">
                This conversation is currently read only. Your exchange history
                remains available.
              </p>
            </div>
          )}

          {/* Composer */}
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!attempt && draft.trim()) void send(createAttempt(draft));
            }}
          >
            <label htmlFor={`message-${id}`} className="sr-only">Message</label>
            <textarea
              id={`message-${id}`}
              className="clay-input resize-none min-h-[100px]"
              placeholder="Type your message here..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={2000}
              rows={3}
              required
              disabled={!latest?.can_send || pending || !!attempt}
            />
            {attempt ? (
              <div className="clay-card p-4 space-y-4">
                <p className="text-sm text-slate-600">
                  Retry checks the same message to avoid sending it twice.
                </p>
                <div className="flex gap-3">
                  <button
                    className="clay-btn px-6 py-2 bg-blue-100 text-blue-800"
                    disabled={pending || !latest?.can_send}
                    onClick={() => void send(attempt)}
                  >
                    {pending ? "Sending…" : "Retry message"}
                  </button>
                  <button
                    className="clay-btn px-6 py-2 text-slate-600"
                    disabled={pending}
                    onClick={() => {
                      setAttempt(undefined);
                      setDraft("");
                      setError(undefined);
                    }}
                  >
                    Discard draft
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  An unconfirmed message may still appear in history after you
                  discard the draft.
                </p>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="clay-btn px-8 py-3 bg-[#d1e8ff] text-slate-800 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={pending || !latest?.can_send || !draft.trim()}
                >
                  {pending ? 'Sending...' : 'Send message'}
                </button>
              </div>
            )}
          </form>
        </div>
      )}
      <FormError message={error} />
    </section>
  );
}