import type { Exchange } from "./types";
export const exchangeStatusTones = {
  PENDING: "info",
  ACCEPTED: "success",
  WAITING_CONFIRMATION: "warning",
  COMPLETED: "complete",
  REJECTED: "danger",
  CANCELLED: "danger",
  EXPIRED: "quiet",
} as const satisfies Record<Exchange["status"], string>;
