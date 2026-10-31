import type { Exchange, ExchangeAction } from "./types";
export function exchangeActions(
  exchange: Exchange,
  userId: string,
  hasOpenIssue = false,
): ExchangeAction[] {
  if (![exchange.requester_id, exchange.owner_id].includes(userId)) return [];
  if (exchange.status === "PENDING")
    return userId === exchange.owner_id ? ["accept", "reject"] : ["cancel"];
  if (exchange.status === "ACCEPTED")
    return hasOpenIssue ? ["cancel"] : ["confirm", "cancel"];
  if (
    exchange.status === "WAITING_CONFIRMATION" &&
    !hasOpenIssue &&
    !(userId === exchange.requester_id
      ? exchange.requester_confirmed
      : exchange.owner_confirmed)
  )
    return ["confirm"];
  return [];
}
export function givingAndReceiving(exchange: Exchange, userId: string) {
  return userId === exchange.requester_id
    ? {
        giving: exchange.offered_snapshot,
        receiving: exchange.requested_snapshot,
      }
    : {
        giving: exchange.requested_snapshot,
        receiving: exchange.offered_snapshot,
      };
}
