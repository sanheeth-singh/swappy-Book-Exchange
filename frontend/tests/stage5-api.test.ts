import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
test("stage five adapters preserve chat retry identity, read watermarks and safety verbs", async () => {
  const original = axios.defaults.adapter;
  const calls: {
    url?: string;
    method?: string;
    data: unknown;
    params: unknown;
  }[] = [];
  axios.defaults.adapter = async (config) => {
    calls.push({
      url: config.url,
      method: config.method,
      data: config.data,
      params: config.params,
    });
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
    const { chatApi, createAttempt } = await import("../src/features/chat/api");
    const { notificationsApi } = await import(
      "../src/features/notifications/api"
    );
    const { blockingApi } = await import("../src/features/blocking/api");
    const { reportsApi } = await import("../src/features/reports/api");
    const { reviewsApi } = await import("../src/features/reviews/api");
    const attempt = createAttempt("Meet at the library");
    await chatApi.send("exchange", attempt);
    await chatApi.send("exchange", attempt);
    assert.deepEqual(calls[0].data, calls[1].data);
    await chatApi.messages("exchange", 42);
    await chatApi.read("exchange", "message");
    await notificationsApi.readAll("visible-newest");
    await notificationsApi.read("notification");
    await blockingApi.block("reader");
    await blockingApi.unblock("reader");
    await reportsApi.create({
      target_type: "LISTING",
      listing_id: "listing",
      reason: "SPAM",
      details: "",
    });
    await reviewsApi.submit("exchange", { rating: 5, comment: null });
    assert.deepEqual(calls[2].params, { limit: 30, before: 42 });
    assert.deepEqual(JSON.parse(String(calls[3].data)), {
      through_message_id: "message",
    });
    assert.deepEqual(JSON.parse(String(calls[4].data)), {
      through_id: "visible-newest",
    });
    assert.equal(calls[6].url, "/blocks/reader");
    assert.equal(calls[7].url, "/blocks/reader/unblock");
    assert.ok(calls.slice(3).every((call) => call.method === "post"));
    assert.equal(calls[8].url, "/reports");
    assert.equal(calls[9].url, "/exchanges/exchange/reviews");
    session.clear();
  } finally {
    axios.defaults.adapter = original;
  }
});
