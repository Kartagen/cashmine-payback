import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, type Activity, type Balances, type ClaimOptions } from './api';
import { applyClaims } from './amount';
import { useClaims } from './claims';

export type Shown = ReturnType<typeof applyClaims>[number];

// One instance for all routes, so balances poll and claims are tracked exactly once.
function useAppState() {
  const claims = useClaims();
  const [bal, setBal] = useState<Balances | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  // Polls can overlap. Data from any of them is kept if it's newer (asOf), but only the latest
  // request decides error/loading, so an old failure can't show "Could not refresh" over fresh data.
  const seq = useRef(0);
  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    try {
      const b = await api.balances();
      setBal((cur) => (cur && Date.parse(cur.asOf) > Date.parse(b.asOf) ? cur : b));
      if (my === seq.current) setError(null);
    } catch (e) {
      if (my === seq.current) setError(e);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000); // snapshots are recomputed every 15 s
    return () => clearInterval(id);
  }, [load]);

  // When a claim settles, the server snapshot changes: refresh right away.
  const settled = claims.list.filter((t) => t.claim && t.claim.status !== 'pending').length;
  useEffect(() => {
    if (settled) load();
  }, [settled, load]);

  const items = bal ? applyClaims(bal, claims.list) : null;
  return { claims, bal, items, error, loading, load };
}

const Ctx = createContext<ReturnType<typeof useAppState> | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={useAppState()}>{children}</Ctx.Provider>;
}
export const useApp = () => useContext(Ctx)!;

// There is no GET /v1/activity/{id}: the list fills this so a detail screen can show an item it loaded.
export const activityCache = new Map<string, Activity>();
// Claim options per asset: switching tabs shows the last known options at once and refreshes them in the background.
export const optionsCache = new Map<string, ClaimOptions>();
