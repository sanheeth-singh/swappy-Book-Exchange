import type { components } from "@/lib/api/generated/schema";
export type HelpEntry = { label: string; description: string };
export const exchangeStatuses = {
 PENDING: { label: "Pending", description: "A proposal has been sent. The requested-book owner may accept or reject it; the requester may withdraw it. The books are not reserved yet." },
 ACCEPTED: { label: "Accepted", description: "Both physical books are reserved. Chat opens so eligible participants can arrange a handover. Either participant may cancel before the first receipt confirmation." },
 WAITING_CONFIRMATION: { label: "Waiting for confirmation", description: "One participant has confirmed receiving their book. The other still needs to confirm. Books remain reserved. Normal cancellation and the accepted-only automatic expiry rule no longer apply." },
 COMPLETED: { label: "Completed", description: "Normally reached when both people confirm receipt. Physical ownership transfers, reservations are released, and the original listings are archived. An administrator can also complete an unresolved accepted exchange after review." },
 REJECTED: { label: "Rejected", description: "The requested-book owner declined the pending proposal, or a competing proposal was rejected when a book was reserved. No ownership transfer occurs." },
 CANCELLED: { label: "Cancelled", description: "A proposal was withdrawn, an accepted exchange was cancelled, or an administrator cancelled it. Reservations are released and ownership does not transfer." },
 EXPIRED: { label: "Expired", description: "An accepted exchange reached its six-day deadline without either participant confirming receipt. When the backend processes expiry, reservations are released and ownership stays unchanged." },
} satisfies Record<components["schemas"]["ExchangeResponse"]["status"], HelpEntry>;
export const conditions = {
 NEW: { label: "New", description: "Suggested description: an unused copy with no known wear." },
 LIKE_NEW: { label: "Like new", description: "Suggested description: a previously owned copy with very little visible wear." },
 GOOD: { label: "Good", description: "Suggested description: a readable copy with some ordinary wear. Mention any markings." },
 FAIR: { label: "Fair", description: "Suggested description: noticeable wear or annotations. Explain the condition clearly and include useful photos." },
 POOR: { label: "Poor", description: "Suggested description: substantial wear or damage. Describe anything that affects readability before agreeing to exchange." },
} satisfies Record<components["schemas"]["PublicBookCard"]["condition"], HelpEntry>;
export const membershipStatuses = {
 NOT_SUBMITTED: { label: "Not submitted", description: "You have not submitted campus proof for review." },
 PENDING: { label: "Pending review", description: "Your proof awaits an administrator’s decision. A second submission is blocked while review is pending." },
 VERIFIED: { label: "Verified", description: "Your proof was approved. Participation also requires active membership, a matching campus and an unexpired verification period." },
 REJECTED: { label: "Rejected", description: "Your proof was declined or expired before review. Read the reason and submit fresh proof when eligible." },
 REVOKED: { label: "Revoked", description: "Your verification was withdrawn. Contact support rather than trying to submit another proof." },
} satisfies Record<string, HelpEntry>;
export const reportReasons = {
 SPAM: { label: "Spam", description: "Unwanted or repetitive content or activity." },
 HARASSMENT: { label: "Harassment", description: "Abusive, threatening, or targeted unwanted behavior." },
 INAPPROPRIATE_CONTENT: { label: "Inappropriate content", description: "Content that needs moderator review for suitability." },
 MISLEADING_LISTING: { label: "Misleading listing", description: "A listing whose information or photos misrepresent the book." },
 OTHER: { label: "Other", description: "A concern that does not fit the other categories. Explain what happened." },
} satisfies Record<components["schemas"]["ReportInput"]["reason"], HelpEntry>;
export const reportStatuses = {
 OPEN: { label: "Open", description: "The report awaits a moderation outcome." },
 RESOLVED: { label: "Resolved", description: "Moderation recorded a resolution. Review the outcome for any action taken." },
 DISMISSED: { label: "Dismissed", description: "Moderation closed the report without upholding it." },
} satisfies Record<components["schemas"]["ReportResponse"]["status"], HelpEntry>;
export const issueStatuses = {
 OPEN: { label: "Open", description: "An exchange concern awaits administrator resolution. Normal receipt confirmations are blocked while an issue remains open." },
 RESOLVED: { label: "Resolved", description: "The issue has been closed as the exchange was completed, cancelled, or otherwise released." },
} satisfies Record<components["schemas"]["IssueResponse"]["status"], HelpEntry>;
export const helpTopics = [ { id: "getting-started", title: "Getting started" }, { id: "membership", title: "Campus verification" }, { id: "books", title: "Books & conditions" }, { id: "exchange-journey", title: "Exchange journey" }, { id: "statuses", title: "Status guide" }, { id: "chat-reviews", title: "Chat & reviews" }, { id: "issues", title: "Issues & reports" }, { id: "reference", title: "More labels explained" } ];
export const journey = [
 { title: "Propose", body: "Offer an available listing you own for another student’s book on the same campus. Both students must be eligible to participate.", status: "Pending" },
 { title: "Reserve", body: "The owner accepts. Both books are reserved, and competing pending proposals involving those listings are rejected.", status: "Accepted" },
 { title: "Arrange and hand over", body: "Use chat when available to agree on a public campus meeting place. Check both books before exchanging. Handover is a real-world step, not a separate status.", status: "Accepted" },
 { title: "Confirm receipt", body: "Each participant confirms only after receiving their book. The first confirmation moves the exchange to waiting; the second completes it.", status: "Waiting → Completed" },
];
