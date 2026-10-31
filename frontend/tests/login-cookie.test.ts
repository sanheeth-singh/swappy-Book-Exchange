import test from "node:test";
import assert from "node:assert/strict";
import axios, { AxiosError } from "axios";
test("login refuses a session that cannot be recovered from its HttpOnly cookie", async () => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      locks: {
        request: async (_name: string, work: () => Promise<unknown>) => work(),
      },
    },
  });
  const old = axios.defaults.adapter;
  let blocked = true;
  axios.defaults.adapter = async (config) => {
    const response = (data: unknown, status = 200) => ({
      config,
      status,
      statusText: "fixture",
      headers: {},
      data,
    });
    if (config.url === "/auth/token")
      return response({
        access_token: "access",
        expires_in: 900,
        session_id: "family",
        csrf_token: "csrf",
        refresh_expires_at: "2030-01-01",
      });
    if (config.url === "/auth/csrf") {
      if (blocked)
        throw new AxiosError(
          "Cookie absent",
          "ERR_BAD_REQUEST",
          config,
          undefined,
          response({}, 401),
        );
      return response({ session_id: "family", csrf_token: "csrf" });
    }
    throw new Error("Unexpected request");
  };
  try {
    const { login, session } = await import("../src/features/auth/session");
    await assert.rejects(login("reader@example.com", "password"), {
      code: "session_cookie_unavailable",
    });
    assert.equal(session.current(), null);
    blocked = false;
    await login("reader@example.com", "password");
    assert.equal(await session.access(), "access");
    session.clear();
  } finally {
    axios.defaults.adapter = old;
  }
});
