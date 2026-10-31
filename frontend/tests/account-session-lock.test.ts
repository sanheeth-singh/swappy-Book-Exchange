import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";

test("cookie-clearing account mutations refresh outside the cookie lock on an expired bearer", async () => {
  let locked = false;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      locks: {
        request: async (_name: string, work: () => Promise<unknown>) => {
          assert.equal(
            locked,
            false,
            "refresh must not acquire a nested Web Lock",
          );
          locked = true;
          try {
            return await work();
          } finally {
            locked = false;
          }
        },
      },
    },
  });
  const old = axios.defaults.adapter;
  const { AxiosError } = await import("axios");
  const paths: string[] = [];
  axios.defaults.adapter = async (config) => {
    paths.push(config.url ?? "");
    const response = (data: unknown, status = 200) => ({
      config,
      status,
      statusText: "fixture",
      headers: {},
      data,
    });
    if (config.url === "/auth/csrf")
      return response({ session_id: "family", csrf_token: "csrf" });
    if (config.url === "/auth/refresh")
      return response({
        access_token: "new-access",
        token_type: "bearer",
        expires_in: 900,
        csrf_token: "csrf",
        session_id: "family",
        refresh_expires_at: "2030-01-01",
      });
    if (config.headers.get("Authorization") === "Bearer old-access")
      throw new AxiosError(
        "Expired",
        "ERR_BAD_REQUEST",
        config,
        undefined,
        response({}, 401),
      );
    return response(null, 204);
  };
  try {
    const { session } = await import("../src/features/auth/session");
    const { accountApi } = await import("../src/features/account/api");
    session.accept({
      access_token: "old-access",
      token_type: "bearer",
      expires_in: 900,
      csrf_token: "csrf",
      session_id: "family",
      refresh_expires_at: "2030-01-01",
    });
    await accountApi.revoke("device");
    assert.deepEqual(paths, [
      "/auth/sessions/device/revoke",
      "/auth/csrf",
      "/auth/refresh",
      "/auth/sessions/device/revoke",
    ]);
    session.clear();
  } finally {
    axios.defaults.adapter = old;
  }
});
