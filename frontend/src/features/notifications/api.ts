import { protectedRequest } from "@/features/auth/session";
import type { components } from "@/lib/api/generated/schema";
export type Notification = components["schemas"]["NotificationResponse"];
export const notificationsApi = {
  list: (before?: string) =>
    protectedRequest<components["schemas"]["NotificationPage"]>({
      url: "/notifications",
      params: { limit: 20, before },
    }),
  count: () =>
    protectedRequest<components["schemas"]["UnreadCount"]>({
      url: "/notifications/unread-count",
    }),
  read: (id: string) =>
    protectedRequest({ method: "POST", url: `/notifications/${id}/read` }),
  readAll: (through_id: string) =>
    protectedRequest({
      method: "POST",
      url: "/notifications/read-all",
      data: { through_id },
    }),
};
export function notificationLink(
  item: Pick<Notification, "resource_type" | "resource_id"> &
    Partial<Pick<Notification, "kind">>,
  admin: boolean,
): string | undefined {
  const id = encodeURIComponent(item.resource_id);
  if (admin) {
    if (item.resource_type === "MEMBERSHIP") return "/admin/memberships";
    if (item.resource_type === "EXCHANGE") return "/admin/issues";
    if (item.resource_type === "ACCOUNT") return "/settings/account";
    if (item.resource_type === "REPORT")
      return `/admin/moderation/reports/${id}`;
    return;
  }
  switch (item.resource_type) {
    case "EXCHANGE":
      return item.kind === "CHAT_MESSAGE"
        ? `/messages/${id}`
        : `/exchanges/${id}`;
    case "MEMBERSHIP":
      return "/membership";
    case "REPORT":
      return `/safety/reports/${id}`;
    case "LISTING":
      return `/my-books/${id}/edit`;
    case "ACCOUNT":
      return "/profile";
  }
}
