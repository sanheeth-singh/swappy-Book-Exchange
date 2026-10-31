import { Suspense } from "react";
import type { Metadata } from "next";
import { ExploreScreen } from "@/features/public-preview/screens/explore-screen";
export const metadata: Metadata = { title: "Explore books" };
export default function Page() { return <Suspense fallback={<p className="container py-12" role="status">Loading discovery…</p>}><ExploreScreen /></Suspense>; }
