import { protectedRequest } from "@/features/auth/session";
import type { Exchange, Issue, ExchangeAction } from "./types";
export const exchangeKeys = {
  all: ["exchanges"] as const,
  detail: (id: string) => ["exchanges", "detail", id] as const,
};
export const exchangesApi = {
  list: (
    direction: "sent" | "received",
    offset: number,
    signal?: AbortSignal,
  ) =>
    protectedRequest<Exchange[]>({
      url: `/exchanges/${direction}`,
      params: { offset, limit: 12 },
      signal,
    }),
  detail: (id: string, signal?: AbortSignal) =>
    protectedRequest<Exchange>({ url: `/exchanges/${id}`, signal }),
  propose: (requested_listing_id: string, offered_listing_id: string) =>
    protectedRequest<Exchange>({
      method: "POST",
      url: "/exchanges",
      data: { requested_listing_id, offered_listing_id },
    }),
  act: (id: string, action: ExchangeAction) =>
    protectedRequest<Exchange>({
      method: "POST",
      url: `/exchanges/${id}/${action}`,
    }),
  issues: (id: string, offset = 0) =>
    protectedRequest<Issue[]>({
      url: `/exchanges/${id}/issues`,
      params: { offset, limit: 20 },
    }),
  issue: (id: string, explanation: string) =>
    protectedRequest<Issue>({
      method: "POST",
      url: `/exchanges/${id}/issues`,
      data: { explanation },
    }),
};
