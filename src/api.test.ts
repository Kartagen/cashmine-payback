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
