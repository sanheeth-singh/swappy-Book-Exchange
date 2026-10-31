"use client";
import type { ReactNode } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { EmptyState } from "@/components/feedback/empty-state";
import { ButtonLink } from "@/components/ui/button";
export function CampusGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user?.display_name && user.campus_id ? (
    children
  ) : (
    <EmptyState
      title="Choose your campus first"
      description="Complete your name and campus to browse these shelves."
      action={<ButtonLink href="/profile">Complete profile</ButtonLink>}
    />
  );
}
