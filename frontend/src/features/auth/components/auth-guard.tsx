"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-provider";
import { destination } from "../roles";
import { ErrorState } from "@/components/feedback/error-state";
export function AuthGuard({
  children,
  role,
}: {
  children: ReactNode;
  role?: "student" | "admin";
}) {
  const auth = useAuth();
  const router = useRouter();
  const wrongRole =
    auth.user && role && (role === "admin") !== auth.user.is_admin;
  useEffect(() => {
    if (auth.status === "guest") router.replace("/login");
    else if (auth.user && wrongRole) router.replace(destination(auth.user));
  }, [auth.status, auth.user, wrongRole, router]);
  if (auth.status === "error" || auth.error)
    return (
      <main className="container py-10">
        <ErrorState
          message={auth.error ?? "Session unavailable."}
          retry={auth.retry}
        />
      </main>
    );
  if (auth.status !== "authenticated" || !auth.user || wrongRole)
    return (
      <p role="status" className="container py-8">
        Checking your session…
      </p>
    );
  return children;
}
