import { protectedRequest } from "@/features/auth/session";
import type { components } from "@/lib/api/generated/schema";
export type ReportInput = components["schemas"]["ReportInput"];
export function reportPayload(
  type: string,
  id: string,
  reason: ReportInput["reason"],
  details: string,
): ReportInput {
  if (
    !["USER", "LISTING"].includes(type) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new Error("Choose a valid reader or listing to report.");
  const text = details.trim();
  if (text.length > 2000 || (reason === "OTHER" && text.length < 10))
    throw new Error("For Other, explain the concern in 10–2000 characters.");
  return type === "USER"
    ? { target_type: "USER", target_user_id: id, reason, details: text }
    : { target_type: "LISTING", listing_id: id, reason, details: text };
}
export const reportsApi = {
  list: (offset = 0) =>
    protectedRequest<components["schemas"]["ReportResponse"][]>({
      url: "/reports/me",
      params: { limit: 20, offset },
    }),
  detail: (id: string) =>
    protectedRequest<components["schemas"]["ReportResponse"]>({
      url: `/reports/${id}`,
    }),
  create: (data: ReportInput) =>
    protectedRequest<components["schemas"]["ReportResponse"]>({
      method: "POST",
      url: "/reports",
      data,
    }),
};
