import type { components } from "@/lib/api/generated/schema";
export type Exchange = components["schemas"]["ExchangeResponse"];
export type Issue = components["schemas"]["IssueResponse"];
export type ExchangeAction = "accept" | "reject" | "cancel" | "confirm";
