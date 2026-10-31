import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionManager } from '../src/features/auth/session-manager';
import type { Tokens } from '../src/features/auth/types';
const tokens: Tokens = { access_token: 'access', token_type: 'bearer', expires_in: 900, csrf_token: 'csrf', session_id: 'id', refresh_expires_at: '2030-01-01' };
const direct = <T>(work: () => Promise<T>) => work();
test('concurrent bootstrap/refresh requests rotate only once and cache access in memory', async () => {
 let csrfCalls = 0; let rotations = 0;
 const manager = createSessionManager({ csrf: async () => { csrfCalls++; return { session_id: 'id', csrf_token: 'csrf' }; }, refresh: async (csrf) => { assert.equal(csrf, 'csrf'); rotations++; return tokens; } }, direct);
 assert.deepEqual(await Promise.all([manager.access(), manager.access()]), ['access', 'access']);
 assert.equal(await manager.access(), 'access'); assert.equal(csrfCalls, 1); assert.equal(rotations, 1);
});
test('expiry triggers refresh and failed refresh can be retried', async () => {
 let time = 0; let calls = 0;
 const manager = createSessionManager({ csrf: async () => ({ session_id: 'id', csrf_token: 'csrf' }), refresh: async () => { calls++; if (calls === 1) throw new Error('offline'); return tokens; } }, direct, () => time);
 await assert.rejects(manager.access()); assert.equal(await manager.access(), 'access');
 time = 901000; await manager.access(); assert.equal(calls, 3);
});
test('sign-out cannot be undone by a late refresh response', async () => {
 let release!: (value: Tokens) => void;
 const manager = createSessionManager({ csrf: async () => ({ session_id: 'id', csrf_token: 'csrf' }), refresh: () => new Promise<Tokens>((resolve) => { release = resolve; }) }, direct);
 const request = manager.access(); await Promise.resolve(); manager.clear(); release(tokens);
 await assert.rejects(request, /Session changed/); assert.equal(manager.current(), null);
});
