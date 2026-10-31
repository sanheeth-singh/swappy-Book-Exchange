import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "@/styles/globals.css";
export const metadata: Metadata = { title: { default: "Swappy — Give your books a next chapter", template: "%s | Swappy" }, description: "Discover books and exchange with readers on your campus." };
export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="en"><body><Providers>{children}</Providers></body></html>; }
