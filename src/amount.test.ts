// Run with: npm test (Node's built-in test runner, no Jest setup needed)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toUnits, fromUnits, checkAmount, usdCents, formatUsd, applyClaims } from './amount.ts';

test('parse and format round-trip, including 18 decimals', () => {
  assert.equal(toUnits('12.345678901234591676', 18), 12345678901234591676n);
  assert.equal(fromUnits(12345678901234591676n, 18), '12.345678901234591676');
  assert.equal(fromUnits(toUnits('0.5', 8), 8), '0.5');
  assert.equal(fromUnits(toUnits('12', 6), 6), '12');
  assert.equal(fromUnits(-2000000n, 6), '-2');
  assert.equal(fromUnits(5n, 8), '0.00000005');
});

const BTC = { decimals: 8, available: '0.01234567', minAmount: '0.0005', fee: '0.00002' };

test('rejects malformed input', () => {
  for (const bad of ['', '.5', '1.', '05', '1e-3', 'abc', '-1', '0.1.1'])
    assert.equal(checkAmount(bad, BTC).ok, false, bad);
});

test('rejects too many decimals, below min, above available', () => {
  assert.match((checkAmount('0.000000001', BTC) as any).error, /decimal/);
  assert.match((checkAmount('0.0004', BTC) as any).error, /Minimum/);
  assert.match((checkAmount('0.01234568', BTC) as any).error, /available/);
});

test('fee and receive amount; Max (= available) is valid', () => {
  const r = checkAmount(BTC.available, BTC);
  assert.ok(r.ok);
  assert.equal(fromUnits(r.receive, 8), '0.01232567');
  const r2 = checkAmount('0,001', BTC); // comma from mobile keyboards
  assert.ok(r2.ok);
  assert.equal(r2.amount, '0.001');
});

test('USD totals are exact to the cent', () => {
  assert.equal(usdCents('0.01234567', 8, '67312.45'), 83102n); // 831.0157... -> $831.02
  assert.equal(usdCents('820.413207', 6, '1.0002'), 82058n); // 820.5772896... -> $820.58
  assert.equal(formatUsd(123456789n), '$1,234,567.89');
  assert.equal(formatUsd(5n), '$0.05');
});

test('claim overlay: applied until the snapshot catches up, never for failed claims', () => {
  const snap = (asOf: string, available: string, claiming: string) => ({
    asOf,
    items: [{ asset: 'BTC', decimals: 8, available, pending: '0', claiming, usdPrice: '1' }],
  });
  const claim = (status: 'pending' | 'completed' | 'failed') => ({
    key: 'k',
    body: { asset: 'BTC', amount: '0.001', destinationId: 'd' },
    claim: { id: 'c', asset: 'BTC', amount: '0.001', destinationId: 'd', fee: '0', receiveAmount: '0.001',
      status, failureReason: null, createdAt: '2026-10-21T14:00:10Z', updatedAt: '' },
  });
  // stale snapshot (before claim): overlay subtracts
  let [b] = applyClaims(snap('2026-10-21T14:00:00Z', '0.01', '0'), [claim('pending')]);
  assert.deepEqual([b.available, b.claiming, b.adjusted], ['0.009', '0.001', true]);
  // fresh snapshot already includes the claim: no double subtract
  [b] = applyClaims(snap('2026-10-21T14:00:15Z', '0.009', '0.001'), [claim('pending')]);
  assert.deepEqual([b.available, b.claiming, b.adjusted], ['0.009', '0.001', false]);
  // failed: money is back, no overlay
  [b] = applyClaims(snap('2026-10-21T14:00:00Z', '0.01', '0'), [claim('failed')]);
  assert.deepEqual([b.available, b.adjusted], ['0.01', false]);
  // mixed precision: as strings "…14:00:10.5Z" < "…14:00:10Z", as dates the snapshot is newer
  [b] = applyClaims(snap('2026-10-21T14:00:10.5Z', '0.009', '0.001'), [claim('pending')]);
  assert.deepEqual([b.available, b.adjusted], ['0.009', false]);
});
