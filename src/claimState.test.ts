import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimState, unresolved } from './claimState.ts';
import type { Tracked } from './claims.ts';

const body = { asset: 'BTC', amount: '0.001', destinationId: 'd1' };
const claim = (status: 'pending' | 'completed' | 'failed', failureReason: string | null = null) =>
  ({ ...body, id: 'c1', fee: '0.0001', receiveAmount: '0.0009', status, failureReason, createdAt: '', updatedAt: '' });
const t = (x: Partial<Tracked>): Tracked => ({ key: 'k', body, ...x });

test('every state has the right title and tone', () => {
  const cases: [Partial<Tracked>, string, string][] = [
    [{}, 'Sending claim…', 'info'],
    [{ unknown: true, sentAt: Date.now() }, 'Checking your claim…', 'info'],
    [{ claim: claim('pending') }, 'Claim in progress', 'info'],
    [{ claim: claim('completed') }, 'Claim completed', 'ok'],
    [{ claim: claim('failed', 'Destination down') }, 'Claim failed', 'bad'],
    [{ error: 'Amount too low' }, 'Claim not submitted', 'bad'],
    [{ error: 'Unauthorized', uncertain: true }, 'Could not confirm claim', 'bad'],
  ];
  for (const [x, title, tone] of cases) {
    const st = claimState(t(x));
    assert.equal(st.title, title); assert.equal(st.tone, tone, title);
  }
});

test('never says "nothing was claimed" after an earlier attempt may have gone through', () => {
  const st = claimState(t({ error: 'Unauthorized', uncertain: true }));
  assert.doesNotMatch(st.detail, /Nothing was claimed/);
  assert.match(st.detail, /may have gone through/);
  assert.match(claimState(t({ error: 'Amount too low' })).detail, /Nothing was claimed/);
});

test('unknown for over a minute tells the user to check Activity', () => {
  assert.doesNotMatch(claimState(t({ unknown: true, sentAt: Date.now() - 10_000 })).detail, /Still no answer/);
  assert.match(claimState(t({ unknown: true, sentAt: Date.now() - 61_000 })).detail, /Still no answer.*Check Activity/);
});

test('failed claim says why and that the money is back', () => {
  const d = claimState(t({ claim: claim('failed', 'Destination down') })).detail;
  assert.match(d, /^Destination down\./);
  assert.match(d, /back in your available balance/);
  assert.match(claimState(t({ claim: claim('failed') })).detail, /^Unknown reason\./);
});

test('unresolved: sending, unknown and pending block a new claim; settled or errored do not', () => {
  assert.equal(unresolved(t({})), true);
  assert.equal(unresolved(t({ unknown: true })), true);
  assert.equal(unresolved(t({ claim: claim('pending') })), true);
  assert.equal(unresolved(t({ claim: claim('completed') })), false);
  assert.equal(unresolved(t({ claim: claim('failed') })), false);
  assert.equal(unresolved(t({ error: 'x' })), false);
});
