import type { Report, ReportDecision, Review } from "./types";
export const reportActionLabels: Record<ReportDecision["action"], string> = {
  DISMISS: "Dismiss report",
  RESOLVE: "Resolve without restriction",
  HIDE_LISTING: "Hide listing",
  RESTRICT_USER: "Restrict new participation",
};
export function reportActions(report: Report, adminId: string) {
  if (
    report.status !== "OPEN" ||
    [report.reporter_id, report.target_user_id].includes(adminId)
  )
    return [];
  return (Object.keys(reportActionLabels) as ReportDecision["action"][]).filter(
    (action) => action !== "HIDE_LISTING" || report.target_type === "LISTING",
  );
}
export function canModerateReview(review: Review, adminId: string) {
  return (
    !!review.published_at &&
    ![review.reviewer_id, review.reviewed_user_id].includes(adminId)
  );
}
