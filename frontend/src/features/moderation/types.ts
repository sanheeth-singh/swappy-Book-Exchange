import type { components } from "@/lib/api/generated/schema";
export type Schema = components["schemas"];
export type Report = Schema["AdminReportResponse"];
export type ReportDecision =
  Schema["app__modules__moderation__schemas__ReviewInput"];
export type Review = Schema["OwnReview"];
export type AuditEntry = {
  id: string;
  action: string;
  note: string;
  actorId: string;
  date: string;
  target?: string;
};
