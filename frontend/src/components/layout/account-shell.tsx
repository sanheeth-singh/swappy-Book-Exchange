"use client";
import type { ReactNode } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { AdminShell } from "./admin-shell";
import { MemberShell } from "./member-shell";
export function AccountShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user?.is_admin ? (
    <AdminShell>{children}</AdminShell>
  ) : (
    <MemberShell>{children}</MemberShell>
  );
}
