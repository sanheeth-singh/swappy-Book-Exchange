import test from "node:test";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import axios, { AxiosError } from "axios";
test("provider moves from guest to signed-in user and clears identity on logout", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: "http://127.0.0.1:3000",
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
  let signedIn = false;
  axios.defaults.adapter = async (config) => {
    const response = (data: unknown, status = 200) => ({
      config,
      data,
      status,
      statusText: "test",
      headers: {},
    });
    if (config.url === "/auth/token") {
      signedIn = true;
      return response({
        access_token: "test-access",
        expires_in: 900,
        csrf_token: "csrf",
        session_id: "test",
        refresh_expires_at: "2030-01-01",
      });
    }
    if (config.url === "/auth/csrf") {
      if (!signedIn)
        throw new AxiosError(
          "No session",
          "ERR_BAD_REQUEST",
          config,
          undefined,
          response({}, 401),
        );
      return response({ csrf_token: "csrf", session_id: "test" });
    }
    if (config.url === "/users/me")
      return response({
        id: "ben",
        is_admin: false,
        email: "ben@example.com",
        display_name: "Ben",
        campus_id: null,
        is_participation_restricted: false,
        avatar_id: "default",
        bio: null,
        reading_interests: [],
      });
    if (config.url === "/auth/logout") {
      signedIn = false;
      return response(null, 204);
    }
    throw new Error(`Unexpected request ${config.url}`);
  };
  const { createElement: h, act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { QueryClient, QueryClientProvider } = createRequire(import.meta.url)(
    "@tanstack/react-query",
  ) as typeof import("@tanstack/react-query");
  const { AuthProvider, useAuth } = await import(
    "../src/features/auth/auth-provider"
  );
  function Harness() {
    const auth = useAuth();
    return h(
      "div",
      null,
      h("p", { id: "state" }, auth.status),
      h("p", { id: "identity" }, auth.user?.email ?? ""),
      h(
        "button",
        {
          id: "login",
          onClick: () => {
            void auth.signIn("ben@example.com", "test-password");
          },
        },
        "Login",
      ),
      h(
        "button",
        {
          id: "logout",
          onClick: () => {
            void auth.signOut();
          },
        },
        "Logout",
      ),
    );
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () =>
      root.render(
        h(QueryClientProvider, { client }, h(AuthProvider, null, h(Harness))),
      ),
    );
    assert.equal(document.getElementById("state")?.textContent, "guest");
    await act(async () => {
      document.getElementById("login")!.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    assert.equal(
      document.getElementById("identity")?.textContent,
      "ben@example.com",
    );
    await act(async () => {
      document.getElementById("logout")!.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    assert.equal(document.getElementById("state")?.textContent, "guest");
    assert.equal(document.getElementById("identity")?.textContent, "");
  } finally {
    await act(async () => root.unmount());
    client.clear();
    dom.window.close();
  }
});
