import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from './api.ts';
import { outcome, resume, type Tracked } from './claims.ts';

const body = { asset: 'BTC', amount: '0.001', destinationId: 'd1' };
const claim = { ...body, id: 'c1', fee: '0', receiveAmount: '0.001', status: 'pending' as const, failureReason: null, createdAt: '', updatedAt: '' };

test('reload: a claim with no server answer resumes as unknown; answered or failed ones stay', () => {
  const sending: Tracked = { key: 'a', body };
  const answered: Tracked = { key: 'b', body, claim };
  const failed: Tracked = { key: 'c', body, error: 'Amount too low' };
  const [a, b, c] = resume([sending, answered, failed]);
  assert.equal(a.unknown, true);
  assert.equal(b.unknown, undefined);
  assert.equal(c.unknown, undefined);
  assert.equal(a.key, 'a'); // the Idempotency-Key is kept, so the resend can't create a second claim
});

test('unknown outcomes keep the same key; definite errors stop', () => {
  for (const status of [0, 500, 503, 504])
    assert.deepEqual(outcome(new ApiError(status, 'X', 'm')), { unknown: true, uncertain: true }, String(status));
  for (const status of [400, 401, 404, 409, 422])
    assert.deepEqual(outcome(new ApiError(status, 'X', 'Bad amount')), { error: 'Bad amount' }, String(status));
  assert.deepEqual(outcome(new Error('boom')), { error: 'boom' });
  assert.deepEqual(outcome('weird'), { error: 'weird' });
});
