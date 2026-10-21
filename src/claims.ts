import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type Claim, type ClaimBody } from './api.ts';

/**
 * A claim this device submitted. `claim` is missing until the server has answered;
 * if the request failed with an unknown outcome, `unknown` is set and we keep retrying
 * with the SAME Idempotency-Key, which can never create a second claim.
 */
export type Tracked = {
  key: string; body: ClaimBody; claim?: Claim; unknown?: boolean; error?: string; sentAt?: number;
  uncertain?: boolean; // an earlier attempt had an unknown outcome, so an error later does NOT mean "nothing claimed"
};

const KEY = 'cm.claims';
const inflight = new Set<string>(); // claim keys with a POST in flight
const load = (): Tracked[] => {
  try {
    const l = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(l) ? l : [];
  } catch {
    return []; // corrupted storage: lose local tracking only; the server stays idempotent, so no money is at risk
  }
};

/** On page load: a claim still "sending" when the page closed has an unknown outcome, so resume checking it. */
export const resume = (l: Tracked[]): Tracked[] => l.map((t) => (!t.claim && !t.error ? { ...t, unknown: true } : t));

/** What a failed send means. Timeout, network or 5xx: maybe created, keep resending with the same key. Anything else: definite. */
export const outcome = (e: unknown): Partial<Tracked> =>
  e instanceof ApiError && e.outcomeUnknown ? { unknown: true, uncertain: true } : { error: e instanceof Error ? e.message : String(e) };

export function useClaims() {
  const [list, setList] = useState<Tracked[]>(() => {
    const l = resume(load());
    localStorage.setItem(KEY, JSON.stringify(l));
    return l;
  });

  const update = useCallback((key: string, patch: Partial<Tracked>) => {
    setList((l) => {
      const next = l.map((t) => (t.key === key ? { ...t, ...patch } : t));
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const send = useCallback(
    async (t: Tracked) => {
      if (inflight.has(t.key)) return;
      inflight.add(t.key);
      update(t.key, { unknown: false, error: undefined });
      try {
        update(t.key, { claim: await api.createClaim(t.body, t.key) });
      } catch (e) {
        update(t.key, outcome(e));
      } finally {
        inflight.delete(t.key);
      }
    },
    [update],
  );

  const submit = useCallback(
    (body: ClaimBody) => {
      const t: Tracked = { key: crypto.randomUUID(), body, sentAt: Date.now() };
      setList((l) => {
        const next = [t, ...l].slice(0, 50); // ponytail: keep last 50, enough for overlay + status
        localStorage.setItem(KEY, JSON.stringify(next));
        return next;
      });
      send(t);
      return t.key;
    },
    [send],
  );

  // Poll pending claims until they settle; re-send unknown ones (same key = safe).
  useEffect(() => {
    const id = setInterval(() => {
      for (const t of load()) {
        if (t.claim?.status === 'pending')
          api.claim(t.claim.id).then((c) => update(t.key, { claim: c }), () => {});
        else if (t.unknown) send(t);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [send, update]);

  const dismiss = useCallback(
    (key: string) =>
      setList((l) => {
        const next = l.filter((t) => t.key !== key);
        localStorage.setItem(KEY, JSON.stringify(next));
        return next;
      }),
    [],
  );

  return { list, submit, send, dismiss };
}
