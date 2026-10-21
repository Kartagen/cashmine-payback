import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, type Balances } from './api';
import { applyClaims } from './amount';
import { useClaims } from './claims';

export type Shown = ReturnType<typeof applyClaims>[number];

// One instance for all routes, so balances poll and claims are tracked exactly once.
function useAppState() {
  const claims = useClaims();
  const [bal, setBal] = useState<Balances | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const b = await api.balances();
      // Ignore a response older than what we already show (responses can arrive out of order).
      setBal((cur) => (cur && Date.parse(cur.asOf) > Date.parse(b.asOf) ? cur : b));
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
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
