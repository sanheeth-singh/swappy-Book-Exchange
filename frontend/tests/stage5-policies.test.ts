import test from "node:test";
import assert from "node:assert/strict";
import {
  createAttempt,
  mergeMessages,
  type ChatPage,
} from "../src/features/chat/api";
import { notificationLink } from "../src/features/notifications/api";
import { reportPayload } from "../src/features/reports/api";
import { validateSelection } from "../src/lib/utils/image-selection";
test("chat history deduplicates polling overlap and orders messages by server sequence", () => {
  const item = (id: string, sequence: number) => ({ id, sequence, body: id });
  const pages = [
    { items: [item("b", 2), item("a", 1)] },
    { items: [item("c", 3), item("b", 2)] },
  ] as ChatPage[];
  assert.deepEqual(
    mergeMessages(pages).map((m) => m.id),
    ["a", "b", "c"],
  );
  const attempt = createAttempt("  hello  ");
  assert.equal(attempt.body, "hello");
  assert.match(attempt.client_message_id, /^[a-f0-9-]{36}$/);
});
test("notification destinations respect admin separation and available moderation routes", () => {
  assert.equal(
    notificationLink({ resource_type: "EXCHANGE", resource_id: "id" }, false),
    "/exchanges/id",
  );
  assert.equal(
    notificationLink({ resource_type: "MEMBERSHIP", resource_id: "id" }, true),
    "/admin/memberships",
  );
  assert.equal(
    notificationLink({ resource_type: "REPORT", resource_id: "id" }, true),
    "/admin/moderation/reports/id",
  );
  assert.equal(
    notificationLink({ resource_type: "REPORT", resource_id: "id" }, false),
    "/safety/reports/id",
  );
});
test("reports use exactly one matching target and enforce Other explanation", () => {
  const id = "12345678-1234-1234-1234-123456789012";
  const user = reportPayload("USER", id, "SPAM", " hello ");
  assert.equal(user.target_user_id, id);
  assert.ok(!("listing_id" in user));
  const listing = reportPayload(
    "LISTING",
    id,
    "OTHER",
    "Long enough explanation",
  );
  assert.equal(listing.listing_id, id);
  assert.ok(!("target_user_id" in listing));
  assert.throws(() => reportPayload("USER", id, "OTHER", "short"));
  assert.throws(() => reportPayload("OTHER", id, "SPAM", ""));
  assert.throws(() => reportPayload("USER", "invalid", "SPAM", ""));
});
test("image selection validates every file and remaining capacity before upload", () => {
  const file = new File(["x"], "photo.png", { type: "image/png" });
  assert.equal(
    validateSelection([file, file, file], 3, () => undefined),
    undefined,
  );
  assert.match(validateSelection([file, file], 1, () => undefined)!, /1/);
  assert.equal(
    validateSelection([file], 3, () => "Unsupported file"),
    "Unsupported file",
  );
});
