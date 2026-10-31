import { protectedRequest } from "@/features/auth/session";
import type { Schema, Report, ReportDecision, Review } from "./types";
export const moderationApi = {
  reports: (status: Report["status"], offset = 0) =>
    protectedRequest<Report[]>({
      url: "/moderation/reports",
      params: { status, offset, limit: 20 },
    }),
  report: (id: string) =>
    protectedRequest<Report>({ url: `/moderation/reports/${id}` }),
  decide: (id: string, data: ReportDecision) =>
    protectedRequest<Report>({
      method: "POST",
      url: `/moderation/reports/${id}/review`,
      data,
    }),
  restoreUser: (id: string, reason: string) =>
    protectedRequest<Schema["RestoreResponse"]>({
      method: "POST",
      url: `/moderation/users/${id}/restore`,
      data: { reason },
    }),
  restoreListing: (id: string, reason: string) =>
    protectedRequest<Schema["RestoreResponse"]>({
      method: "POST",
      url: `/moderation/listings/${id}/restore`,
      data: { reason },
    }),
  actions: (offset = 0) =>
    protectedRequest<Schema["ActionResponse"][]>({
      url: "/moderation/actions",
      params: { limit: 20, offset },
    }),
  reviews: (hidden: boolean, offset = 0) =>
    protectedRequest<Review[]>({
      url: "/moderation/reviews",
      params: { hidden, limit: 20, offset },
    }),
  moderate: (id: string, data: Schema["ModerationInput"]) =>
    protectedRequest<Review>({
      method: "POST",
      url: `/moderation/reviews/${id}`,
      data,
    }),
  reviewActions: (id: string, offset = 0) =>
    protectedRequest<Schema["AuditResponse"][]>({
      url: `/moderation/reviews/${id}/actions`,
      params: { limit: 20, offset },
    }),
};
