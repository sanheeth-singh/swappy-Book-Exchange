"use client";
import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/api/query-client";
import { AuthProvider } from "@/features/auth/auth-provider";
import { ToastHost } from "@/components/ui/toast";
import { OverlayHost } from "@/components/overlays/overlay-host";
export function Providers({ children }: { children: ReactNode }) { const [client] = useState(makeQueryClient); return <QueryClientProvider client={client}><AuthProvider>{children}<ToastHost /><OverlayHost /></AuthProvider></QueryClientProvider>; }
