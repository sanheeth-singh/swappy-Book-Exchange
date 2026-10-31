import test from "node:test";
import assert from "node:assert/strict";
import { createSessionManager } from "../src/features/auth/session-manager";
import { ApiError } from "../src/lib/api/errors";
import type { Tokens } from "../src/features/auth/types";
test("cold reload restores from the cookie, rotates it once, and recovers repeatedly without browser token storage", async () => {
  let cookie = "credential-1";
  let refreshes = 0;
  const bundle = (access_token: string): Tokens => ({
    access_token,
    token_type: "bearer",
    expires_in: 900,
    csrf_token: "csrf",
    session_id: "family",
    refresh_expires_at: "2030-01-01",
  });
  const transport = {
    csrf: async () => {
      assert.ok(cookie);
      return { session_id: "family", csrf_token: "csrf" };
    },
    refresh: async (csrf: string) => {
      assert.equal(csrf, "csrf");
      refreshes++;
      cookie = `credential-${refreshes + 1}`;
      return bundle(`access-${refreshes}`);
    },
  };
  const lock = async <T>(work: () => Promise<T>) => work();
  const initial = createSessionManager(transport, lock);
  initial.accept(bundle("login-access"));
  assert.equal(await initial.access(), "login-access");
  assert.equal(refreshes, 0);
  for (let i = 1; i <= 3; i++) {
    const fresh = createSessionManager(transport, lock);
    assert.equal(fresh.current(), null);
    assert.deepEqual(
      await Promise.all([fresh.access(), fresh.access(), fresh.access()]),
      Array(3).fill(`access-${i}`),
    );
    assert.equal(refreshes, i);
    assert.equal(cookie, `credential-${i + 1}`);
  }
});
test("temporary restoration failure is retryable without converting a live cookie into a sign-out", async () => {
  let unavailable = true;
  const manager = createSessionManager(
    {
      csrf: async () => {
        if (unavailable)
          throw new ApiError("Offline", undefined, "network_error");
        return { session_id: "id", csrf_token: "csrf" };
      },
      refresh: async () => ({
        access_token: "restored",
        token_type: "bearer",
        expires_in: 900,
        csrf_token: "csrf",
        session_id: "id",
        refresh_expires_at: "2030-01-01",
      }),
    },
    async (work) => work(),
  );
  await assert.rejects(manager.access(), /Offline/);
  unavailable = false;
  assert.equal(await manager.access(), "restored");
});
