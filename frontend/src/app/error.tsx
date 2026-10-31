"use client";
import { ErrorState } from "@/components/feedback/error-state";
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <main className="container py-12"><ErrorState message="Please try loading this page again." retry={reset} /></main>; }
