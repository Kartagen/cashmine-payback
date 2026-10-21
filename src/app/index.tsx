import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CaretRightIcon } from 'phosphor-react-native';
import { setToken } from '../api';
import { formatUsd, toUnits, usdCents } from '../amount';
import { useApp, type Shown } from '../store';
import { color, num, space, type } from '../theme';
import { Btn, ClaimBanner, errText, ErrorLine, Line, Loader, Page, s, Title, unresolved } from '../ui';

export default function Home() {
  const { claims, bal, items, error, loading, load } = useApp();
  return (
    <Page>
      <View style={[s.row, { alignItems: 'flex-end' }]}>
        <Title>Balance</Title>
        <Btn title="Change token" kind="text" onPress={() => (setToken(null), location.replace('/'))} style={{ marginBottom: space.m }} />
      </View>

      {claims.list.length > 0 && (
        <View style={s.section}>
          {claims.list.slice(0, 3).map((t) =>
            <ClaimBanner key={t.key} t={t} onOpen={() => router.push(`/status/${t.key}`)} onDismiss={() => claims.dismiss(t.key)} />)}
        </View>
      )}

      {!bal && loading && <Loader />}
      {error != null && <ErrorLine error={bal ? `Could not refresh. ${errText(error)}` : error} onRetry={load} />}

      {bal && items && (
        <>
          <View style={{ gap: space.xs, paddingVertical: space.s }}>
            <Text style={type.footnote}>Total, available and pending</Text>
            <Text style={type.figure}>
              {formatUsd(items.reduce((sum, it) =>
                sum + usdCents(it.available, it.decimals, it.usdPrice) + usdCents(it.pending, it.decimals, it.usdPrice), 0n))}
            </Text>
            <View style={s.row}>
              <Freshness asOf={bal.asOf} />
              <Btn title={loading ? 'Refreshing…' : 'Refresh'} kind="text" onPress={load} disabled={loading} />
            </View>
          </View>

          <View>
            {items.map((it) => (
              <AssetRow key={it.asset} it={it} busy={claims.list.some((t) => t.body.asset === it.asset && unresolved(t))}
                onClaim={() => router.push(`/claim/${it.asset}`)} />
            ))}
          </View>

          <Pressable onPress={() => router.push('/activity')} accessibilityRole="link" style={[s.row, s.divider, { paddingVertical: space.l }]}>
            <Text style={type.bodyStrong}>Activity</Text>
            <CaretRightIcon size={18} color={color.secondary} />
          </Pressable>
        </>
      )}
    </Page>
  );
}

function Freshness({ asOf }: { asOf: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const sec = Math.max(0, Math.round((now - Date.parse(asOf)) / 1000));
  const label = sec < 60 ? `${sec}s ago` : `${Math.round(sec / 60)} min ago`;
  return <Text style={[type.footnote, sec > 60 && { color: color.text }]}>Updated {label}{sec > 60 ? ' (may be outdated)' : ''}</Text>;
}

function AssetRow({ it, busy, onClaim }: { it: Shown; busy: boolean; onClaim: () => void }) {
  const canClaim = toUnits(it.available, it.decimals) > 0n && !busy;
  return (
    <View style={[s.section, { paddingBottom: space.l }]}>
      <View style={s.row}>
        <Text style={type.title}>{it.asset}</Text>
        <Text style={[type.body, num, { color: color.secondary }]}>
          {formatUsd(usdCents(it.available, it.decimals, it.usdPrice))}
        </Text>
      </View>
      <Line label="Available" value={`${it.available} ${it.asset}`} strong />
      <Line label="Pending" value={`${it.pending} ${it.asset}`} />
      {it.claiming !== '0' && <Line label={it.adjusted ? 'Claiming, incl. your new claim' : 'Claiming'} value={`${it.claiming} ${it.asset}`} />}
      <Btn title={busy ? 'Claim in progress…' : 'Claim'} disabled={!canClaim} onPress={onClaim} style={{ marginTop: space.xs }} />
    </View>
  );
}
