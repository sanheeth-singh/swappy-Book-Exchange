"use client";
import { ButtonLink } from "@/components/ui/button";
import { ConversationInbox } from "../components/conversation-inbox";
import { ConversationThread } from "../components/conversation-thread";

export function MessagesScreen({ id }: { id?: string }) {
  return (
    <div className="clay-theme min-h-[100dvh] p-0 md:p-6 lg:p-8 flex flex-col">
      {/* Hide page header on mobile when chat is open for a native feel */}
      <header className={`px-4 pt-6 md:px-2 md:pt-0 mb-6 ${id ? 'hidden md:block' : 'block'}`}>
        <p className="eyebrow text-sm font-bold tracking-widest text-[#a83f08] uppercase">
          Arrange Handover
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight">Messages</h1>
      </header>

      <div 
        className="messenger flex flex-col md:flex-row gap-6 flex-1 h-[calc(100dvh-120px)]" 
        data-thread-open={!!id}
      >
        {/* Inbox Sidebar */}
        <div className={`w-full md:w-[320px] lg:w-[380px] shrink-0 h-full flex flex-col ${id ? 'hidden md:flex' : 'flex'}`}>
          <ConversationInbox selectedId={id} />
        </div>

        {/* Chat Thread Area */}
        <section
          className={`conversation-pane flex-1 flex flex-col h-full ${!id ? 'hidden md:flex' : 'flex'}`}
          aria-label="Selected conversation"
        >
          {id ? (
            <ConversationThread key={id} id={id} />
          ) : (
            <div className="card p-10 flex flex-col items-center justify-center h-full bg-gradient-to-br from-[#fffbf5] to-[#f7efe5] border-none shadow-clay rounded-[2rem]">
              <div className="w-20 h-20 mb-6 rounded-full bg-[#f7efe5] flex items-center justify-center shadow-[inset_6px_6px_12px_rgba(31,22,18,0.06),inset_-6px_-6px_12px_rgba(255,255,255,0.9)]">
                <svg className="w-8 h-8 text-[#ea6113]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 text-center">
                Select a conversation
              </h2>
              <p className="mt-3 text-slate-500 font-medium text-center max-w-sm">
                Choose an accepted exchange to arrange the handover. Chat opens automatically when an exchange is confirmed.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}