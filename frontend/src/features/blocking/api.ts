import { protectedRequest } from "@/features/auth/session";
import type { components } from "@/lib/api/generated/schema";
export const blockingApi = {
  list: (offset = 0) =>
    protectedRequest<components["schemas"]["BlockListItem"][]>({
      url: "/blocks",
      params: { limit: 20, offset },
    }),
  block: (id: string) =>
    protectedRequest({ method: "POST", url: `/blocks/${id}` }),
  unblock: (id: string) =>
    protectedRequest({ method: "POST", url: `/blocks/${id}/unblock` }),
};
