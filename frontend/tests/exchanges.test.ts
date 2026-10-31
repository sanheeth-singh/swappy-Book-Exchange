import test from "node:test";
import assert from "node:assert/strict";
import {
  exchangeActions,
  givingAndReceiving,
} from "../src/features/exchanges/policies";
import { discoveryLink } from "../src/lib/config/discovery";
import type { Exchange } from "../src/features/exchanges/types";
const exchange = {
  requester_id: "requester",
  owner_id: "owner",
  status: "PENDING",
  requester_confirmed: false,
  owner_confirmed: false,
  requested_snapshot: { title: "Requested" },
  offered_snapshot: { title: "Offered" },
} as Exchange;
test("pending actions depend on participant role and terminal states have no mutations", () => {
  assert.deepEqual(exchangeActions(exchange, "owner"), ["accept", "reject"]);
  assert.deepEqual(exchangeActions(exchange, "requester"), ["cancel"]);
  assert.deepEqual(exchangeActions(exchange, "stranger"), []);
  for (const status of [
    "COMPLETED",
    "EXPIRED",
    "REJECTED",
    "CANCELLED",
  ] as const)
    assert.deepEqual(exchangeActions({ ...exchange, status }, "owner"), []);
});
test("open issues and previous receipt confirmations block further ordinary confirmations", () => {
  const waiting = {
    ...exchange,
    status: "WAITING_CONFIRMATION",
    requester_confirmed: true,
  } as Exchange;
  assert.deepEqual(exchangeActions(waiting, "requester"), []);
  assert.deepEqual(exchangeActions(waiting, "owner"), ["confirm"]);
  assert.deepEqual(exchangeActions(waiting, "owner", true), []);
  assert.deepEqual(
    exchangeActions({ ...exchange, status: "ACCEPTED" }, "owner", true),
    ["cancel"],
  );
});
test("giving and receiving are shown from each participant perspective", () => {
  assert.equal(
    givingAndReceiving(exchange, "requester").giving.title,
    "Offered",
  );
  assert.equal(givingAndReceiving(exchange, "owner").giving.title, "Requested");
});
test("visitors explore, students discover and administrators use their workspace", () => {
  assert.equal(discoveryLink().href, "/explore");
  assert.equal(discoveryLink({ is_admin: false }).href, "/books");
  assert.equal(discoveryLink({ is_admin: true }).href, "/admin");
});
