import type { Tracked } from './claims';

export const unresolved = (t: Tracked) => !t.error && (!t.claim || t.claim.status === 'pending');

/** The banner/status text for a tracked claim. Never says "nothing was claimed" if an earlier attempt may have gone through. */
export function claimState(t: Tracked): { title: string; detail: string; tone: 'info' | 'ok' | 'bad' } {
  const what = `${t.body.amount} ${t.body.asset}`;
  if (t.error && t.uncertain)
    return { title: 'Could not confirm claim', detail: `${what}: ${t.error}. It may have gone through. Check Activity before claiming again.`, tone: 'bad' };
  if (t.error) return { title: 'Claim not submitted', detail: `${what}: ${t.error}. Nothing was claimed.`, tone: 'bad' };
  if (!t.claim && t.unknown)
    return { title: 'Checking your claim…', tone: 'info', detail: `The connection dropped while sending ${what}. We keep checking with the same key, so it can't be claimed twice.`
      + (Date.now() - (t.sentAt ?? Date.now()) > 60000 ? ' Still no answer from the server. Check Activity before trying again.' : '') };
  if (!t.claim) return { title: 'Sending claim…', detail: what, tone: 'info' };
  const c = t.claim;
  if (c.status === 'pending') return { title: 'Claim in progress', detail: `${what}, you receive ${c.receiveAmount}. Usually under 20 s.`, tone: 'info' };
  if (c.status === 'completed') return { title: 'Claim completed', detail: `${c.receiveAmount} ${c.asset} sent.`, tone: 'ok' };
  return { title: 'Claim failed', detail: `${c.failureReason ?? 'Unknown reason'}. ${what} is back in your available balance.`, tone: 'bad' };
}
