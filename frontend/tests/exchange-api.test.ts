import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
test("exchange adapter uses listing IDs and POST lifecycle operations from the backend contract", async () => {
  const original = axios.defaults.adapter;
  const calls: { url?: string; method?: string; data: unknown }[] = [];
  axios.defaults.adapter = async (config) => {
    calls.push({ url: config.url, method: config.method, data: config.data });
    return {
      config,
      status: 200,
      statusText: "fixture",
      headers: {},
      data: {},
    };
  };
  try {
    const { session } = await import("../src/features/auth/session");
    session.accept({
      access_token: "fixture",
      token_type: "bearer",
      expires_in: 900,
      csrf_token: "fixture",
      session_id: "fixture",
      refresh_expires_at: "2030-01-01",
    });
    const { exchangesApi } = await import("../src/features/exchanges/api");
    await exchangesApi.propose("requested-listing", "offered-listing");
    for (const action of ["accept", "reject", "cancel", "confirm"] as const)
      await exchangesApi.act("exchange", action);
    await exchangesApi.issue("exchange", "A handover issue explanation.");
    assert.deepEqual(JSON.parse(String(calls[0].data)), {
      requested_listing_id: "requested-listing",
      offered_listing_id: "offered-listing",
    });
    assert.deepEqual(
      calls.slice(1, 5).map((call) => call.url),
      [
        "/exchanges/exchange/accept",
        "/exchanges/exchange/reject",
        "/exchanges/exchange/cancel",
        "/exchanges/exchange/confirm",
      ],
    );
    assert.ok(calls.every((call) => call.method === "post"));
    assert.equal(
      JSON.parse(String(calls[5].data)).explanation,
      "A handover issue explanation.",
    );
    session.clear();
  } finally {
    axios.defaults.adapter = original;
  }
});
