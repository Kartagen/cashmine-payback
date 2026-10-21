import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { api, ApiError, getToken, setToken, type Activity, type Balances, type ClaimOptions } from './src/api';
import { applyClaims, checkAmount, formatUsd, fromUnits, toUnits, usdCents } from './src/amount';
import { useClaims, type Tracked } from './src/claims';

type Screen = { name: 'home' } | { name: 'claim'; asset: string } | { name: 'status'; key: string } | { name: 'activity' };
type Shown = ReturnType<typeof applyClaims>[number];

const errText = (e: unknown) =>
  e instanceof ApiError && e.status === 401 ? 'Your token is invalid or expired. Change it below.' : e instanceof Error ? e.message : String(e);
const unresolved = (t: Tracked) => !t.error && (!t.claim || t.claim.status === 'pending');

export default function App() {
  const [hasToken, setHasToken] = useState(!!getToken());
  if (!hasToken) return <TokenGate onDone={() => setHasToken(true)} />;
  return <Main />;
}

function TokenGate({ onDone }: { onDone: () => void }) {
  const [t, setT] = useState('');
  return (
    <Page>
      <Text style={s.h1}>CashMine</Text>
      <Text style={s.muted}>Paste your API token to continue. It is stored only in this browser.</Text>
      <TextInput style={s.input} value={t} onChangeText={setT} placeholder="ct1...." autoCapitalize="none" autoCorrect={false} />
      <Btn title="Continue" disabled={!t.trim()} onPress={() => (setToken(t.trim()), onDone())} />
    </Page>
  );
}

function Main() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const claims = useClaims();
  const [bal, setBal] = useState<Balances | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const b = await api.balances();
      // Ignore a response older than what we already show (responses can arrive out of order).
      setBal((cur) => (cur && cur.asOf > b.asOf ? cur : b));
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
  const go = setScreen;

  if (screen.name === 'claim' && items)
    return <ClaimScreen items={items} asset={screen.asset} busy={claims.list} onBack={() => go({ name: 'home' })}
      onSubmit={(body) => go({ name: 'status', key: claims.submit(body) })} />;
  if (screen.name === 'status') {
    const t = claims.list.find((x) => x.key === screen.key);
    return <Page><Back onPress={() => go({ name: 'home' })} />{t ? <ClaimStatus t={t} onRetry={() => claims.send(t)} /> : null}</Page>;
  }
  if (screen.name === 'activity') return <ActivityScreen onBack={() => go({ name: 'home' })} />;

  return (
    <Page>
      <View style={s.row}>
        <Text style={s.h1}>Payback</Text>
        <Pressable onPress={() => (setToken(null), location.reload())}><Text style={s.link}>Change token</Text></Pressable>
      </View>

      {claims.list.slice(0, 3).map((t) =>
        <ClaimBanner key={t.key} t={t} onOpen={() => go({ name: 'status', key: t.key })} onDismiss={() => claims.dismiss(t.key)} />)}

      {!bal && loading && <ActivityIndicator style={{ marginTop: 40 }} />}
      {error != null && (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{bal ? 'Could not refresh: ' : 'Could not load balances: '}{errText(error)}</Text>
          <Btn title="Retry" onPress={load} small />
        </View>
      )}

      {bal && items && (
        <>
          <View style={s.card}>
            <Text style={s.muted}>Total (available + pending)</Text>
            <Text style={s.total}>
              {formatUsd(items.reduce((sum, it) =>
                sum + usdCents(it.available, it.decimals, it.usdPrice) + usdCents(it.pending, it.decimals, it.usdPrice), 0n))}
            </Text>
            <View style={s.row}>
              <Freshness asOf={bal.asOf} />
              <Pressable onPress={load} disabled={loading}><Text style={s.link}>{loading ? 'Refreshing…' : 'Refresh'}</Text></Pressable>
            </View>
          </View>
          {items.map((it) => (
            <AssetRow key={it.asset} it={it} busy={claims.list.some((t) => t.body.asset === it.asset && unresolved(t))}
              onClaim={() => go({ name: 'claim', asset: it.asset })} />
          ))}
          <Btn title="Activity" onPress={() => go({ name: 'activity' })} secondary />
        </>
      )}
    </Page>
  );
}

function Freshness({ asOf }: { asOf: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const sec = Math.max(0, Math.round((now - Date.parse(asOf)) / 1000));
  const label = sec < 60 ? `${sec}s ago` : `${Math.round(sec / 60)} min ago`;
  return <Text style={[s.muted, sec > 60 && s.warn]}>Updated {label}{sec > 60 ? ' (may be outdated)' : ''}</Text>;
}

function AssetRow({ it, busy, onClaim }: { it: Shown; busy: boolean; onClaim: () => void }) {
  const canClaim = toUnits(it.available, it.decimals) > 0n && !busy;
  return (
    <View style={s.card}>
      <View style={s.row}>
        <Text style={s.h2}>{it.asset}</Text>
        <Text style={s.muted}>{formatUsd(usdCents(it.available, it.decimals, it.usdPrice))}</Text>
      </View>
      <Line label="Available" value={`${it.available} ${it.asset}`} strong />
      <Line label="Pending" value={`${it.pending} ${it.asset}`} />
      {it.claiming !== '0' && <Line label={it.adjusted ? 'Claiming (incl. your new claim)' : 'Claiming'} value={`${it.claiming} ${it.asset}`} />}
      <Btn title={busy ? 'Claim in progress…' : 'Claim'} disabled={!canClaim} onPress={onClaim} small />
    </View>
  );
}

function ClaimScreen({ items, asset: initial, busy, onBack, onSubmit }: {
  items: Shown[]; asset: string; busy: Tracked[]; onBack: () => void;
  onSubmit: (b: { asset: string; amount: string; destinationId: string }) => void;
}) {
  const [asset, setAsset] = useState(initial);
  const [opts, setOpts] = useState<ClaimOptions | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [amount, setAmount] = useState('');
  const [dest, setDest] = useState<string | null>(null);
  const [review, setReview] = useState(false);
  const it = items.find((x) => x.asset === asset)!;
  const isBusy = busy.some((t) => t.body.asset === asset && unresolved(t));

  const loadOpts = useCallback(() => {
    setOpts(null); setError(null);
    api.claimOptions(asset).then((o) => { setOpts(o); setDest(o.destinations[0]?.id ?? null); }, setError);
  }, [asset]);
  useEffect(loadOpts, [loadOpts]);

  const check = opts ? checkAmount(amount, { decimals: it.decimals, available: it.available, minAmount: opts.minAmount, fee: opts.fee }) : null;

  return (
    <Page>
      <Back onPress={review ? () => setReview(false) : onBack} />
      <Text style={s.h1}>Claim</Text>
      <View style={s.chips}>
        {items.map((x) => (
          <Pressable key={x.asset} disabled={review} onPress={() => (setAsset(x.asset), setAmount(''))}
            style={[s.chip, x.asset === asset && s.chipOn]}>
            <Text style={x.asset === asset ? s.chipOnText : undefined}>{x.asset}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.muted}>Available: {it.available} {it.asset}</Text>

      {!opts && !error && <ActivityIndicator style={{ marginTop: 20 }} />}
      {error != null && <View style={s.errorBox}><Text style={s.errorText}>{errText(error)}</Text><Btn title="Retry" onPress={loadOpts} small /></View>}

      {opts && !review && (
        <>
          <View style={s.row}>
            <TextInput style={[s.input, { flex: 1 }]} value={amount} onChangeText={setAmount} inputMode="decimal"
              placeholder={`Min ${opts.minAmount}`} autoCorrect={false} />
            <Btn title="Max" small secondary onPress={() => setAmount(it.available)} />
          </View>
          {amount !== '' && check && !check.ok && <Text style={s.errorText}>{check.error}</Text>}
          <Text style={s.label}>Send to</Text>
          {opts.destinations.map((d) => (
            <Pressable key={d.id} onPress={() => setDest(d.id)} style={[s.chip, dest === d.id && s.chipOn, { marginBottom: 6 }]}>
              <Text style={dest === d.id ? s.chipOnText : undefined}>{d.label}</Text>
            </Pressable>
          ))}
          <Line label="Fee" value={`${opts.fee} ${asset}`} />
          <Line label="You receive" value={check?.ok ? `${fromUnits(check.receive, it.decimals)} ${asset}` : '—'} strong />
          {isBusy && <Text style={s.warn}>A claim for {asset} is still in progress. Wait for it to finish.</Text>}
          <Btn title="Review" disabled={!check?.ok || !dest || isBusy} onPress={() => setReview(true)} />
        </>
      )}

      {opts && review && check?.ok && dest && (
        <View style={s.card}>
          <Text style={s.h2}>Confirm claim</Text>
          <Line label="Amount" value={`${check.amount} ${asset}`} />
          <Line label="Fee" value={`−${opts.fee} ${asset}`} />
          <Line label="You receive" value={`${fromUnits(check.receive, it.decimals)} ${asset}`} strong />
          <Line label="To" value={opts.destinations.find((d) => d.id === dest)!.label} />
          <Btn title="Confirm and claim" onPress={() => onSubmit({ asset, amount: check.amount, destinationId: dest })} />
        </View>
      )}
    </Page>
  );
}

function claimState(t: Tracked): { title: string; detail: string; tone: 'info' | 'ok' | 'bad' } {
  const what = `${t.body.amount} ${t.body.asset}`;
  if (t.error && t.uncertain)
    return { title: 'Could not confirm claim', detail: `${what}: ${t.error}. It may have gone through — check Activity before claiming again.`, tone: 'bad' };
  if (t.error) return { title: 'Claim not submitted', detail: `${what}: ${t.error}. Nothing was claimed.`, tone: 'bad' };
  if (!t.claim && t.unknown)
    return { title: 'Checking your claim…', detail: `We lost the connection while sending ${what}. We keep checking safely — it can never be claimed twice.`, tone: 'info' };
  if (!t.claim) return { title: 'Sending claim…', detail: what, tone: 'info' };
  const c = t.claim;
  if (c.status === 'pending') return { title: 'Claim in progress', detail: `${what}, you receive ${c.receiveAmount}. Usually takes under 20 s.`, tone: 'info' };
  if (c.status === 'completed') return { title: 'Claim completed', detail: `${c.receiveAmount} ${c.asset} sent.`, tone: 'ok' };
  return { title: 'Claim failed', detail: `${c.failureReason ?? 'Unknown reason'}. ${what} is back in your available balance.`, tone: 'bad' };
}

function ClaimBanner({ t, onOpen, onDismiss }: { t: Tracked; onOpen: () => void; onDismiss: () => void }) {
  const st = claimState(t);
  return (
    <Pressable onPress={onOpen} style={[s.banner, s[st.tone]]}>
      <View style={{ flex: 1 }}>
        <Text style={s.bold}>{st.title}</Text>
        <Text>{st.detail}</Text>
      </View>
      {!unresolved(t) && <Pressable onPress={onDismiss}><Text style={s.link}>✕</Text></Pressable>}
    </Pressable>
  );
}

function ClaimStatus({ t, onRetry }: { t: Tracked; onRetry: () => void }) {
  const st = claimState(t);
  return (
    <View style={[s.card, s[st.tone]]}>
      {unresolved(t) && <ActivityIndicator />}
      <Text style={s.h2}>{st.title}</Text>
      <Text>{st.detail}</Text>
      {t.claim && <Text style={s.muted}>Claim id {t.claim.id}</Text>}
      {t.unknown && !t.claim && <Btn title="Check now" small onPress={onRetry} />}
    </View>
  );
}

function ActivityScreen({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<Activity[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined); // undefined = first page, null = end
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const more = useCallback(async () => {
    if (loading || cursor === null) return;
    setLoading(true); setError(null);
    try {
      const page = await api.activity(cursor);
      setItems((l) => [...l, ...page.items]);
      setCursor(page.nextCursor);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading]);
  useEffect(() => { more(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={s.page}>
      <Back onPress={onBack} />
      <Text style={s.h1}>Activity</Text>
      <FlatList
        data={items}
        keyExtractor={(a) => a.id}
        onEndReached={more}
        onEndReachedThreshold={0.5}
        renderItem={({ item: a }) => (
          <View style={[s.row, s.activity]}>
            <View>
              <Text style={s.bold}>{a.type[0].toUpperCase() + a.type.slice(1)}{a.exchange ? ` · ${a.exchange}` : ''}</Text>
              <Text style={s.muted}>{new Date(a.createdAt).toLocaleString()} · {a.status}</Text>
            </View>
            <Text style={[s.bold, a.amount.startsWith('-') && { color: '#b42318' }]}>{a.amount} {a.asset}</Text>
          </View>
        )}
        ListFooterComponent={
          error != null ? <View style={s.errorBox}><Text style={s.errorText}>{errText(error)}</Text><Btn title="Retry" small onPress={more} /></View>
          : loading ? <ActivityIndicator style={{ margin: 16 }} />
          : cursor === null ? <Text style={[s.muted, { textAlign: 'center', margin: 16 }]}>{items.length ? 'End of history' : 'No activity yet'}</Text>
          : <Btn title="Load more" small secondary onPress={more} />
        }
      />
    </View>
  );
}

// --- small UI helpers ---
function Page({ children }: { children: React.ReactNode }) {
  return <ScrollView contentContainerStyle={s.page}><StatusBar style="auto" />{children}</ScrollView>;
}
const Back = ({ onPress }: { onPress: () => void }) => <Pressable onPress={onPress}><Text style={s.link}>‹ Back</Text></Pressable>;
const Line = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <View style={s.row}><Text style={s.muted}>{label}</Text><Text style={[strong && s.bold, s.value]} selectable>{value}</Text></View>
);
function Btn({ title, onPress, disabled, small, secondary }: { title: string; onPress: () => void; disabled?: boolean; small?: boolean; secondary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}
      style={[s.btn, small && s.btnSmall, secondary && s.btnSecondary, disabled && { opacity: 0.4 }]}>
      <Text style={[s.btnText, secondary && { color: '#1d4ed8' }]}>{title}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, gap: 12, width: '100%', maxWidth: 480, alignSelf: 'center', flexGrow: 1 },
  h1: { fontSize: 26, fontWeight: '700' },
  h2: { fontSize: 18, fontWeight: '700' },
  total: { fontSize: 32, fontWeight: '700' },
  muted: { color: '#667085' },
  warn: { color: '#b54708' },
  bold: { fontWeight: '600' },
  value: { flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  label: { fontWeight: '600', marginTop: 4 },
  link: { color: '#1d4ed8', fontWeight: '600', padding: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: '#eaecf0' },
  input: { borderWidth: 1, borderColor: '#d0d5dd', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fff' },
  btn: { backgroundColor: '#1d4ed8', borderRadius: 10, padding: 14, alignItems: 'center' },
  btnSmall: { padding: 10 },
  btnSecondary: { backgroundColor: '#eff4ff' },
  btnText: { color: '#fff', fontWeight: '600' },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: '#d0d5dd', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  chipOnText: { color: '#fff', fontWeight: '600' },
  errorBox: { backgroundColor: '#fef3f2', borderRadius: 10, padding: 12, gap: 8 },
  errorText: { color: '#b42318' },
  banner: { flexDirection: 'row', borderRadius: 10, padding: 12, gap: 8 },
  info: { backgroundColor: '#eff8ff' },
  ok: { backgroundColor: '#ecfdf3' },
  bad: { backgroundColor: '#fef3f2' },
  activity: { paddingVertical: 10, borderBottomWidth: 1, borderColor: '#eaecf0' },
});
