import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
test("account and moderation adapters match exact verbs, password bytes, filters and audit routes", async () => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      locks: {
        request: async (_name: string, work: () => Promise<unknown>) => work(),
      },
    },
  });
  const old = axios.defaults.adapter;
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
      access_token: "access",
      token_type: "bearer",
      expires_in: 900,
      csrf_token: "csrf",
      session_id: "session",
      refresh_expires_at: "2030-01-01",
    });
    const { accountApi } = await import("../src/features/account/api");
    const { detailsApi } = await import("../src/features/profile/details-api");
    const { moderationApi } = await import("../src/features/moderation/api");
    await accountApi.sessions(20);
    await accountApi.revoke("device");
    await accountApi.password({
      current_password: " old password ",
      new_password: " new password ",
    });
    await accountApi.eligibility();
    await accountApi.deactivate({ current_password: " unchanged bytes " });
    await accountApi.logoutAll();
    await detailsApi.update({
      bio: null,
      reading_interests: [],
      avatar_id: "reader_01",
    });
    await detailsApi.books("reader", "cursor");
    await moderationApi.reports("OPEN", 20);
    await moderationApi.decide("report", {
      action: "RESTRICT_USER",
      summary: "A reviewed concern.",
    });
    await moderationApi.restoreUser("reader", "Valid reason for restoration.");
    await moderationApi.restoreListing(
      "listing",
      "Valid reason for restoration.",
    );
    await moderationApi.reviews(true, 20);
    await moderationApi.moderate("review", {
      action: "HIDE",
      reason: "Reviewed inappropriate content.",
    });
    await moderationApi.reviewActions("review", 20);
    await moderationApi.actions(20);
    assert.deepEqual(
      calls.slice(0, 6).map((c) => [c.method, c.url]),
      [
        ["get", "/auth/sessions"],
        ["post", "/auth/sessions/device/revoke"],
        ["post", "/users/me/password"],
        ["get", "/users/me/deactivation"],
        ["post", "/users/me/deactivate"],
        ["post", "/auth/logout-all"],
      ],
    );
    assert.equal(
      JSON.parse(String(calls[2].data)).current_password,
      " old password ",
    );
    assert.equal(
      JSON.parse(String(calls[4].data)).current_password,
      " unchanged bytes ",
    );
    assert.equal(calls[6].method, "patch");
    assert.equal(JSON.parse(String(calls[6].data)).bio, null);
    assert.deepEqual(calls[7].params, { limit: 12, before: "cursor" });
    assert.equal(calls[8].url, "/moderation/reports");
    assert.deepEqual(calls[8].params, {
      status: "OPEN",
      offset: 20,
      limit: 20,
    });
    assert.equal(calls[9].url, "/moderation/reports/report/review");
    assert.equal(calls[10].url, "/moderation/users/reader/restore");
    assert.equal(calls[11].url, "/moderation/listings/listing/restore");
    assert.deepEqual(calls[12].params, { hidden: true, limit: 20, offset: 20 });
    assert.equal(calls[14].url, "/moderation/reviews/review/actions");
    assert.equal(calls[15].url, "/moderation/actions");
    session.clear();
  } finally {
    axios.defaults.adapter = old;
  }
});
