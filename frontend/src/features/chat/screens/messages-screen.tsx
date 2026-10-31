"use client";
import { ButtonLink } from "@/components/ui/button";
import { ConversationInbox } from "../components/conversation-inbox";
import { ConversationThread } from "../components/conversation-thread";

export function MessagesScreen({ id }: { id?: string }) {
  return (
    <div className="clay-theme min-h-screen p-4 md:p-8 space-y-6">
      <header className="mb-8 px-2">
        <p className="eyebrow text-sm font-semibold tracking-wider text-slate-500 uppercase">
          Arrange your next handover
        </p>
        <h1 className="mt-2 text-4xl font-bold text-slate-800 tracking-tight">Messages</h1>
      </header>
      
      {id && (
        <ButtonLink
          variant="secondary"
          className="clay-btn px-6 py-2 inline-block mb-4 md:hidden"
          href="/messages"
        >
          All conversations
        </ButtonLink>
      )}

      <div 
        className="messenger flex flex-col md:flex-row gap-8 items-start" 
        data-thread-open={!!id}
      >
        <div className="w-full md:w-1/3 shrink-0">
          <ConversationInbox selectedId={id} />
        </div>

        <section
          className="conversation-pane w-full md:w-2/3 flex flex-col gap-6"
          aria-label="Selected conversation"
        >
          {id ? (
            <ConversationThread key={id} id={id} />
          ) : (
            <div className="clay-card p-10 text-center flex flex-col items-center justify-center min-h-[50vh]">
              <div className="w-24 h-24 mb-6 rounded-full bg-[#e6eaf0] flex items-center justify-center shadow-[inset_6px_6px_12px_rgba(163,177,198,0.7),inset_-6px_-6px_12px_rgba(255,255,255,0.9)]">
                {/* Optional icon placeholder here */}
                <span className="text-4xl text-slate-400">👋</span>
              </div>
              <h2 className="text-3xl font-bold text-slate-700">
                Your next chapter starts with a conversation.
              </h2>
              <p className="mt-4 text-slate-500 max-w-md">
                Choose an accepted exchange to arrange the handover. Receipt
                confirmations and safety controls stay beside your chat.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}