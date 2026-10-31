"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, normalizeApiError } from "@/lib/api/errors";
import { login, logout, protectedRequest, session } from "./session";
import { requireKnownRole } from "./roles";
import type { User } from "./types";
type Auth = {
  status: "loading" | "guest" | "authenticated" | "error";
  user?: User;
  error?: string;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
  endLocalSession: () => void;
  retry: () => void;
};
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [status, setStatus] = useState<Auth["status"]>("loading");
  const [error, setError] = useState<string>();
  const channel = useRef<BroadcastChannel | null>(null);
  const version = useRef(0);
  const clear = useCallback(() => {
    version.current++;
    session.clear();
    void client.cancelQueries();
    client.clear();
    setStatus("guest");
    setError(undefined);
  }, [client]);
  const bootstrap = useCallback(async () => {
    const epoch = ++version.current;
    try {
      await session.access();
      if (epoch === version.current) setStatus("authenticated");
    } catch (failure) {
      if (epoch !== version.current) return;
      const problem = normalizeApiError(failure);
      if (problem.status === 401) {
        session.clear();
        setStatus("guest");
      } else {
        setError(problem.message);
        setStatus("error");
      }
    }
  }, []);
  useEffect(() => {
    let active = true;
    const epoch = ++version.current;
    void session.access().then(
      () => {
        if (active && epoch === version.current) setStatus("authenticated");
      },
      (failure: unknown) => {
        if (!active || epoch !== version.current) return;
        const problem = normalizeApiError(failure);
        if (problem.status === 401) {
          session.clear();
          setStatus("guest");
        } else {
          setError(problem.message);
          setStatus("error");
        }
      },
    );
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("swappy-identity");
      channel.current.onmessage = () => clear();
    }
    window.addEventListener("swappy-session-ended", clear);
    return () => {
      active = false;
      channel.current?.close();
      window.removeEventListener("swappy-session-ended", clear);
    };
  }, [clear]);
  const me = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async ({ signal }) =>
      requireKnownRole(
        await protectedRequest<User>({ url: "/users/me", signal }),
      ),
    enabled: status === "authenticated",
    retry: false,
  });
  const effectiveStatus =
    me.error instanceof ApiError && me.error.status === 401 ? "guest" : status;
  async function signIn(email: string, password: string) {
    version.current++;
    await client.cancelQueries();
    client.clear();
    await login(email, password);
    const user = requireKnownRole(
      await protectedRequest<User>({ url: "/users/me" }),
    );
    client.setQueryData(["auth", "me"], user);
    channel.current?.postMessage("identity-changed");
    setStatus("authenticated");
    setError(undefined);
    return user;
  }
  async function signOut() {
    await logout();
    channel.current?.postMessage("signed-out");
    clear();
  }
  return (
    <Context.Provider
      value={{
        status: effectiveStatus,
        user: me.data,
        error: error ?? me.error?.message,
        signIn,
        signOut,
        endLocalSession: () => {
          channel.current?.postMessage("signed-out");
          clear();
        },
        retry: () => {
          if (status === "authenticated") void me.refetch();
          else {
            setStatus("loading");
            setError(undefined);
            void bootstrap();
          }
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider is missing");
  return value;
}
