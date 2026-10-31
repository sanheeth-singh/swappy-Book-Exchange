import test from 'node:test';
import assert from 'node:assert/strict';
import axios, { AxiosError } from 'axios';
test('form login, 401 recovery and logout follow bearer, cookie and CSRF contracts', async () => {
 const calls: { path: string; bearer: unknown; csrf: unknown; body: unknown; credentials: unknown }[] = [];
 Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request: async (_name: string, work: () => Promise<unknown>) => work() } } });
 const oldAdapter = axios.defaults.adapter;
 axios.defaults.adapter = async (config) => {
  const path = config.url ?? ''; const bearer = config.headers.get('Authorization');
  calls.push({ path, bearer, csrf: config.headers.get('X-CSRF-Token'), body: config.data, credentials: config.withCredentials });
  const response = (data: unknown, status = 200) => ({ config, data, status, statusText: 'test', headers: {} });
  const bundle = (access_token: string) => ({ access_token, token_type: 'bearer', expires_in: 900, csrf_token: 'csrf', session_id: 'test', refresh_expires_at: '2030-01-01' });
  if (path === '/auth/token') return response(bundle('old-access'));
  if (path === '/auth/csrf') return response({ session_id: 'test', csrf_token: 'csrf-current' });
  if (path === '/auth/refresh') return response(bundle('new-access'));
  if (path === '/auth/logout') return response(null, 204);
  if (path === '/users/me' && bearer === 'Bearer old-access') throw new AxiosError('Expired', 'ERR_BAD_REQUEST', config, undefined, response({}, 401));
  if (path === '/users/me') return response({ id: 'user' });
  throw new Error('Unexpected request');
 };
 try {
  const { login, logout, protectedRequest, session } = await import('../src/features/auth/session');
  await login('BEN@example.com', 'test-password');
  assert.deepEqual(await protectedRequest({ url: '/users/me' }), { id: 'user' });
  await logout(); assert.equal(session.current(), null);
  assert.match(String(calls[0].body), /username=ben%40example.com/);
  assert.equal(calls.find((call) => call.path === '/auth/refresh')?.csrf, 'csrf-current');
  assert.equal(calls.find((call) => call.path === '/auth/logout')?.csrf, 'csrf-current');
  assert.equal(calls.filter((call) => call.path === '/auth/refresh').length, 1);
  assert.equal(calls.every((call) => call.credentials === true), true);
 } finally { axios.defaults.adapter = oldAdapter; }
});
