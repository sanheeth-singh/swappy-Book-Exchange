import type { Metadata } from "next";
import { HelpScreen } from "@/features/help/screens/help-screen";
export const metadata: Metadata = { title: "How Swappy works", description: "Understand campus verification, book conditions, exchange stages, confirmations and support." };
export default function Page() { return <HelpScreen />; }
