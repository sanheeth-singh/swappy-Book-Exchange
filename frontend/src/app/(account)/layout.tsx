import type { ReactNode } from "react";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { AccountShell } from "@/components/layout/account-shell";
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AccountShell>{children}</AccountShell>
    </AuthGuard>
  );
}
