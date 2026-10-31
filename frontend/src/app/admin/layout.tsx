import type { ReactNode } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { AuthGuard } from "@/features/auth/components/auth-guard";
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard role="admin">
      <AdminShell>{children}</AdminShell>
    </AuthGuard>
  );
}
