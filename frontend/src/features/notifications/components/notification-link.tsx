"use client";
import { Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { ButtonLink } from "@/components/ui/button";
import { notificationsApi } from "../api";
export function NotificationLink() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["notifications", "count"],
    queryFn: notificationsApi.count,
    enabled: !!user,
    refetchInterval: 20000,
  });
  const count = query.data?.unread_count;
  return (
    <ButtonLink
      variant="ghost"
      href="/notifications"
      aria-label={`Notifications${count ? `, ${count} unread` : ""}`}
    >
      <Bell size={18} aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">Notifications</span>
      {!!count && <span className="badge">{count > 99 ? "99+" : count}</span>}
    </ButtonLink>
  );
}
