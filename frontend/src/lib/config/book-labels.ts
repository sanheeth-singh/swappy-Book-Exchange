import type { components } from "@/lib/api/generated/schema";
export const conditionLabels = { NEW: "New", LIKE_NEW: "Like new", GOOD: "Good", FAIR: "Fair", POOR: "Poor" } satisfies Record<components["schemas"]["PublicBookCard"]["condition"], string>;
