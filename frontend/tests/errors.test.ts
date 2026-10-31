import test from "node:test";
import assert from "node:assert/strict";
import { normalizeApiError } from "../src/lib/api/errors";
test("preserves backend domain errors", () => { const error = normalizeApiError({ isAxiosError: true, response: { status: 403, data: { error: { code: "membership_required", message: "Verify your membership." } } } }); assert.equal(error.status, 403); assert.equal(error.code, "membership_required"); assert.equal(error.message, "Verify your membership."); });
test("maps FastAPI validation fields", () => { const error = normalizeApiError({ isAxiosError: true, response: { status: 422, data: { detail: [{ loc: ["body", "title"], msg: "Required" }] } } }); assert.deepEqual(error.fields, { title: "Required" }); });
test("network failures do not expose transport details", () => { const error = normalizeApiError({ isAxiosError: true }); assert.equal(error.code, "network_error"); });
