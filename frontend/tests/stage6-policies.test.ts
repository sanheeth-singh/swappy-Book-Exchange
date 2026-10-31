import test from "node:test";
import assert from "node:assert/strict";
import {
  reportActions,
  canModerateReview,
} from "../src/features/moderation/policies";
import type { Report, Review } from "../src/features/moderation/types";
import { readingInterests } from "../src/features/profile/details-api";
import { execFileSync } from "node:child_process";
test("browser API stays same origin even when a legacy environment points directly at the backend", () => {
  const value = execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      "import { env } from './src/lib/config/env.ts'; process.stdout.write(env.apiUrl);",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:8000/api/v1",
      },
      encoding: "utf8",
    },
  );
  assert.equal(value, "/api/v1");
});
test("moderation prevents conflicting administrators and invalid listing decisions", () => {
  const report = {
    status: "OPEN",
    reporter_id: "reporter",
    target_user_id: "reader",
    target_type: "USER",
  } as Report;
  assert.deepEqual(reportActions(report, "reporter"), []);
  assert.deepEqual(reportActions(report, "reader"), []);
  assert.ok(!reportActions(report, "admin").includes("HIDE_LISTING"));
  assert.ok(
    reportActions({ ...report, target_type: "LISTING" }, "admin").includes(
      "HIDE_LISTING",
    ),
  );
  assert.deepEqual(
    reportActions({ ...report, status: "RESOLVED" }, "admin"),
    [],
  );
  const review = {
    reviewer_id: "one",
    reviewed_user_id: "two",
    published_at: "2026-10-31",
  } as Review;
  assert.equal(canModerateReview(review, "one"), false);
  assert.equal(canModerateReview(review, "two"), false);
  assert.equal(canModerateReview(review, "admin"), true);
  assert.equal(
    canModerateReview({ ...review, published_at: null }, "admin"),
    false,
  );
});
test("reader interests deduplicate without changing case and enforce backend bounds", () => {
  assert.deepEqual(readingInterests(" Fiction, fiction, History "), [
    "Fiction",
    "History",
  ]);
  assert.throws(() =>
    readingInterests(Array.from({ length: 9 }, (_, i) => `item${i}`).join(",")),
  );
  assert.throws(() => readingInterests("x".repeat(41)));
  assert.throws(() => readingInterests("bad\u0000value"));
  assert.deepEqual(readingInterests(""), []);
});
