import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";
import axios, { AxiosError } from "axios";
test("strict-mode cold provider waits for cookie recovery and restores identity without a guest redirect", async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://localhost:3000",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Event: dom.window.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      userAgent: "jsdom",
      locks: {
        request: async (_name: string, work: () => Promise<unknown>) => work(),
      },
    },
  });
  const old = axios.defaults.adapter;
  let refreshes = 0;
  let cookie = "stored-refresh";
  let release: (() => void) | undefined;
  axios.defaults.adapter = async (config) => {
    const response = (data: unknown, status = 200) => ({
      config,
      status,
      statusText: "fixture",
      headers: {},
      data,
    });
    if (config.url === "/auth/csrf") {
      assert.equal(cookie, "stored-refresh");
      return response({ session_id: "family", csrf_token: "csrf" });
    }
    if (config.url === "/auth/refresh") {
      refreshes++;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      cookie = "rotated-refresh";
      return response({
        access_token: "restored-access",
        token_type: "bearer",
        expires_in: 900,
        csrf_token: "csrf",
        session_id: "family",
        refresh_expires_at: "2030-01-01",
      });
    }
    if (config.url === "/users/me") {
      assert.equal(
        config.headers.get("Authorization"),
        "Bearer restored-access",
      );
      return response({
        id: "reader",
        is_admin: false,
        email: "reader@example.com",
        display_name: "Reader",
        campus_id: null,
      });
    }
    throw new AxiosError(
      "Unexpected request",
      "ERR_BAD_REQUEST",
      config,
      undefined,
      response({}, 401),
    );
  };
  const { createElement: h, act, StrictMode } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { QueryClient, QueryClientProvider } = createRequire(import.meta.url)(
    "@tanstack/react-query",
  ) as typeof import("@tanstack/react-query");
  const { session } = await import("../src/features/auth/session");
  session.clear();
  const { AuthProvider, useAuth } = await import(
    "../src/features/auth/auth-provider"
  );
  const statuses: string[] = [];
  function Harness() {
    const auth = useAuth();
    statuses.push(auth.status);
    return h("p", { id: "state" }, `${auth.status}:${auth.user?.email ?? ""}`);
  }
  const root = createRoot(document.getElementById("root")!);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  try {
    await act(async () =>
      root.render(
        h(
          StrictMode,
          null,
          h(QueryClientProvider, { client }, h(AuthProvider, null, h(Harness))),
        ),
      ),
    );
    assert.match(document.querySelector("#state")!.textContent!, /^loading:/);
    assert.equal(refreshes, 1);
    assert.ok(release);
    await act(async () => {
      release!();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    assert.equal(
      document.querySelector("#state")!.textContent,
      "authenticated:reader@example.com",
    );
    assert.equal(cookie, "rotated-refresh");
    assert.ok(!statuses.includes("guest"));
    assert.equal(refreshes, 1);
  } finally {
    await act(async () => root.unmount());
    client.clear();
    session.clear();
    axios.defaults.adapter = old;
    dom.window.close();
  }
});
