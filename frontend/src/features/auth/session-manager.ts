import type { Tokens, Csrf } from "./types";
export type SessionTransport = { csrf: () => Promise<Csrf>; refresh: (csrf: string) => Promise<Tokens> };
export function createSessionManager(transport: SessionTransport, coordinate: <T>(work: () => Promise<T>) => Promise<T>, now = Date.now) {
 let token: Tokens | null = null; let deadline = 0; let generation = 0; let flight: Promise<string> | null = null;
 function clear() { generation++; token = null; deadline = 0; flight = null; }
 function accept(value: Tokens) { generation++; token = value; deadline = now() + value.expires_in * 1000; }
 async function access(force = false): Promise<string> {
  if (!force && token && now() < deadline - 30000) return token.access_token;
  if (flight) return flight;
  const epoch = generation;
  const operation = coordinate(async () => {
   const csrf = await transport.csrf(); const value = await transport.refresh(csrf.csrf_token);
   if (epoch !== generation) throw new Error("Session changed. Please retry.");
   token = value; deadline = now() + value.expires_in * 1000; return value.access_token;
  });
  flight = operation;
  try { return await operation; } finally { if (flight === operation) flight = null; }
 }
 return { access, accept, clear, current: () => token };
}
