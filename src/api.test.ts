import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRetryAfter } from './api.ts';

test('Retry-After: missing, seconds, HTTP date, garbage', () => {
  assert.equal(parseRetryAfter(null), 1000);
  assert.equal(parseRetryAfter('2'), 2000);
  assert.equal(parseRetryAfter('0'), 0);
  const ms = parseRetryAfter(new Date(Date.now() + 3000).toUTCString());
  assert.ok(ms > 1500 && ms <= 3000, `date form gave ${ms}`); // toUTCString drops ms
  assert.equal(parseRetryAfter(new Date(Date.now() - 5000).toUTCString()), 0); // past date: retry now
  assert.equal(parseRetryAfter('soon'), 1000);
  assert.equal(parseRetryAfter(''), 1000);
});

// --- request policy: a fake fetch and fake timers, so backoff and the 15 s timeout don't really wait ---
import { afterEach, mock } from 'node:test';
import { api, ApiError, cleanToken, validToken } from './api.ts';

afterEach(() => mock.timers.reset());
(globalThis as any).localStorage = { getItem: () => 'tok', setItem() {}, removeItem() {} };
type Reply = (init: RequestInit) => Response | Promise<Response>;
const reply = (status: number, body: unknown = {}, headers: Record<string, string> = {}): Reply => () =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
let calls: { url: string; init: RequestInit }[] = [];
function serve(...replies: Reply[]) {
  calls = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return replies.shift()!(init); }) as any;
}
// Run a request to completion, firing every pending timer whenever it's waiting on one.
async function settle<T>(p: Promise<T>): Promise<T> {
  let done = false;
  p.then(() => (done = true), () => (done = true));
  while (!done) { await new Promise((r) => setImmediate(r)); mock.timers.runAll(); }
  return p;
}
const fails = async (p: Promise<unknown>) => { try { await settle(p); } catch (e) { return e as ApiError; } throw new Error('expected a failure'); };

test('5xx and network errors retry up to 3 tries, then fail as unknown outcome', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  serve(reply(500), reply(503), reply(200, { asOf: 'x', items: [] }));
  assert.deepEqual(await settle(api.balances()), { asOf: 'x', items: [] });
  assert.equal(calls.length, 3);

  serve(reply(503), reply(503), reply(503));
  const e = await fails(api.balances());
  assert.equal(calls.length, 3);
  assert.equal(e.status, 503); assert.equal(e.outcomeUnknown, true);
});

test('4xx fails at once, with the server error passed through', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  for (const status of [400, 401, 404]) {
    serve(reply(status, { error: { code: 'VALIDATION', message: 'Amount too low', field: 'amount' } }));
    const e = await fails(api.balances());
    assert.equal(calls.length, 1, String(status));
    assert.deepEqual([e.status, e.code, e.message, e.field, e.outcomeUnknown], [status, 'VALIDATION', 'Amount too low', 'amount', false]);
  }
  serve(() => new Response('<html>bad request</html>', { status: 400 })); // no JSON body: still a usable error
  const e = await fails(api.balances());
  assert.deepEqual([e.code, e.message], ['SERVER', 'HTTP 400']);
});

test('429 waits exactly the server-given time before retrying', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  serve(reply(429, { error: { retryAfterMs: 2500 } }), reply(200, { ok: 1 }));
  const p = api.balances();
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  assert.equal(calls.length, 1);
  mock.timers.tick(2499); for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  assert.equal(calls.length, 1, 'retried too early');
  mock.timers.tick(1);
  assert.deepEqual(await settle(p), { ok: 1 });
  assert.equal(calls.length, 2);
});

test('a body that stalls after the headers times out as an unknown outcome', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const stall: Reply = (init) => new Response(new ReadableStream({
    start(c) { init.signal!.addEventListener('abort', () => c.error(new DOMException('aborted', 'AbortError'))); },
  }), { status: 200 });
  serve(stall, stall, stall);
  const e = await fails(api.balances());
  assert.equal(e.status, 0); assert.equal(e.outcomeUnknown, true);
  assert.equal(calls.length, 3);
});

test('a token the browser refuses to put in a header is a 401, not a network error', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  serve(() => { throw new TypeError("Failed to execute 'fetch': Invalid value for header 'Authorization'"); });
  const e = await fails(api.balances());
  assert.deepEqual([e.status, calls.length], [401, 1]);
  serve(() => { throw new TypeError('Failed to fetch'); }, () => { throw new TypeError('Failed to fetch'); }, () => { throw new TypeError('Failed to fetch'); });
  assert.equal((await fails(api.balances())).status, 0);
});

test('claim retries reuse the same Idempotency-Key and body', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const body = { asset: 'BTC', amount: '0.001', destinationId: 'd1' };
  serve(reply(504), reply(503), reply(201, { ...body, id: 'c1' }));
  assert.equal((await settle(api.createClaim(body, 'key-1'))).id, 'c1');
  assert.equal(calls.length, 3);
  for (const c of calls) {
    assert.equal(c.init.method, 'POST');
    assert.equal((c.init.headers as Record<string, string>)['Idempotency-Key'], 'key-1');
    assert.equal(c.init.body, JSON.stringify(body));
    assert.equal((c.init.headers as Record<string, string>).Authorization, 'Bearer tok');
  }
});

test('token pasted from email: whitespace and zero-width chars removed, non-ASCII rejected', () => {
  assert.equal(cleanToken(' ct1.ab​c\n\tdef﻿ '), 'ct1.abcdef');
  assert.equal(validToken('ct1.abc-DEF_123'), true);
  assert.equal(validToken('ct1.äbc'), false);
  assert.equal(validToken(''), false);
});
