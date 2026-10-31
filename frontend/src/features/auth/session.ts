import axios, { type AxiosRequestConfig } from "axios";
import { env } from "@/lib/config/env";
import { ApiError, normalizeApiError } from "@/lib/api/errors";
import { createSessionManager } from "./session-manager";
import type { Csrf, Tokens } from "./types";
const transport = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
  timeout: 15000,
});
export async function coordinate<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request("swappy-session-cookie", work);
  throw new ApiError(
    "Session recovery needs a browser with secure Web Locks support. Use an up-to-date browser on HTTPS or 127.0.0.1.",
  );
}
export const session = createSessionManager(
  {
    csrf: async () => (await transport.get<Csrf>("/auth/csrf")).data,
    refresh: async (csrf) =>
      (
        await transport.post<Tokens>("/auth/refresh", null, {
          headers: { "X-CSRF-Token": csrf },
        })
      ).data,
  },
  coordinate,
);
export async function login(email: string, password: string) {
  try {
    const value = await coordinate(async () => {
      const issued = (
        await transport.post<Tokens>(
          "/auth/token",
          new URLSearchParams({
            username: email.trim().toLowerCase(),
            password,
          }),
        )
      ).data;
      try {
        const restored = (await transport.get<Csrf>("/auth/csrf")).data;
        if (restored.session_id !== issued.session_id)
          throw new ApiError(
            "Session cookie does not match.",
            undefined,
            "session_cookie_unavailable",
          );
      } catch (failure) {
        const problem = normalizeApiError(failure);
        if (
          problem.status !== 401 &&
          problem.code !== "session_cookie_unavailable"
        )
          throw problem;
        throw new ApiError(
          "Sign-in succeeded, but this browser could not restore the session cookie. Keep the site on the same address, allow cookies, and check the local cookie settings in the installation guide.",
          undefined,
          "session_cookie_unavailable",
        );
      }
      return issued;
    });
    session.accept(value);
  } catch (error) {
    session.clear();
    throw normalizeApiError(error);
  }
}
export async function logout() {
  try {
    await coordinate(async () => {
      const csrf = (await transport.get<Csrf>("/auth/csrf")).data;
      await transport.post("/auth/logout", null, {
        headers: { "X-CSRF-Token": csrf.csrf_token },
      });
    });
  } catch (error) {
    const normalized = normalizeApiError(error);
    if (normalized.status !== 401) throw normalized;
  }
  session.clear();
}
export async function protectedRequest<T>(
  config: AxiosRequestConfig,
): Promise<T> {
  try {
    const original = await session.access();
    try {
      return (
        await transport.request<T>({
          ...config,
          headers: { ...config.headers, Authorization: `Bearer ${original}` },
        })
      ).data;
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        throw error;
      const token =
        session.current()?.access_token !== original
          ? await session.access()
          : await session.access(true);
      return (
        await transport.request<T>({
          ...config,
          headers: { ...config.headers, Authorization: `Bearer ${token}` },
        })
      ).data;
    }
  } catch (error) {
    const normalized = normalizeApiError(error);
    if (normalized.status === 401) {
      session.clear();
      window.dispatchEvent(new Event("swappy-session-ended"));
    }
    throw normalized;
  }
}

// Cookie-clearing account actions share the refresh lock; acquire access first to avoid nested locks.
export async function sessionMutation<T>(
  config: AxiosRequestConfig,
): Promise<T> {
  const send = (token: string) =>
    coordinate(
      async () =>
        (
          await transport.request<T>({
            ...config,
            headers: { ...config.headers, Authorization: `Bearer ${token}` },
          })
        ).data,
    );
  try {
    const original = await session.access();
    try {
      return await send(original);
    } catch (failure) {
      if (!axios.isAxiosError(failure) || failure.response?.status !== 401)
        throw failure;
      // Refresh only after the mutation releases the cookie lock. A 401 happens before the action is authorized.
      const token =
        session.current()?.access_token !== original
          ? await session.access()
          : await session.access(true);
      return await send(token);
    }
  } catch (failure) {
    const problem = normalizeApiError(failure);
    if (problem.status === 401) {
      session.clear();
      if (typeof window !== "undefined")
        window.dispatchEvent(new Event("swappy-session-ended"));
    }
    throw problem;
  }
}
