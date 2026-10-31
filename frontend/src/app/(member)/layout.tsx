import type { ReactNode } from "react";
import { MemberShell } from "@/components/layout/member-shell";
import { AuthGuard } from "@/features/auth/components/auth-guard";
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard role="student">
      <MemberShell>{children}</MemberShell>
    </AuthGuard>
  );
}
