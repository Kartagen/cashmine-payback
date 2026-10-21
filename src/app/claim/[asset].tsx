import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CircleIcon, RadioButtonIcon } from 'phosphor-react-native';
import { api, type ClaimOptions } from '../../api';
import { checkAmount, fromUnits } from '../../amount';
import { optionsCache, useApp } from '../../store';
import { color, space, type } from '../../theme';
import { Btn, ErrorLine, Line, Loader, Page, s, Title, unresolved } from '../../ui';

export default function ClaimScreen() {
  const { items, claims, error: balError, load } = useApp();
  const { asset } = useLocalSearchParams<{ asset: string }>(); // the URL is the selected tab
  const [opts, setOpts] = useState<ClaimOptions | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [amount, setAmount] = useState('');
  const [dest, setDest] = useState<string | null>(null);
  const [review, setReview] = useState(false);
  const [sent, setSent] = useState(false); // one tap = one claim; a double tap must not create a second key
  const it = items?.find((x) => x.asset === asset);
  const isBusy = claims.list.some((t) => t.body.asset === asset && unresolved(t));

  const [fresh, setFresh] = useState(false); // options confirmed by the server for this asset, not just cached
  const [reload, setReload] = useState(0);
  const loadOpts = useCallback(() => setReload((n) => n + 1), []);
  useEffect(() => {
    let current = true; // a late answer for the previous tab must not overwrite this one
    const show = (o: ClaimOptions) => {
      setOpts(o);
      setDest((d) => (o.destinations.some((x) => x.id === d) ? d : o.destinations[0]?.id ?? null));
    };
    const cached = optionsCache.get(asset);
    if (cached) show(cached); else setOpts(null);
    setError(null); setFresh(false);
    api.claimOptions(asset).then(
      (o) => { optionsCache.set(asset, o); if (current) { show(o); setFresh(true); } },
      (e) => { if (current) setError(e); }, // with a cache, the form stays and Review waits for a successful retry
    );
    return () => { current = false; };
  }, [asset, reload]);

  // Deep link before balances load, or an unknown asset.
  if (!items && balError != null) return <Page><Title>Claim</Title><ErrorLine error={balError} onRetry={load} /></Page>;
  if (!items) return <Page><Title>Claim</Title><Loader /></Page>;
  if (!it) return <Page><Title>Claim</Title><Text style={type.body}>No balance for {asset}.</Text></Page>;

  const check = opts ? checkAmount(amount, { decimals: it.decimals, available: it.available, minAmount: opts.minAmount, fee: opts.fee }) : null;

  return (
    <Page>
      <Title>{review ? 'Confirm claim' : 'Claim'}</Title>
      {!review && (
        <View style={[s.divider, { flexDirection: 'row', gap: space.xl }]} accessibilityRole="tablist">
          {items.map((x) => {
            const on = x.asset === asset;
            return (
              <Pressable key={x.asset} accessibilityRole="tab" accessibilityState={{ selected: on }}
                onPress={() => (router.setParams({ asset: x.asset }), setAmount(''))}
                style={{ paddingVertical: space.s, borderBottomWidth: 2, borderColor: on ? color.text : 'transparent', marginBottom: -1 }}>
                <Text style={[type.bodyStrong, !on && { color: color.secondary }]}>{x.asset}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {!opts && !error && <Loader />}
      {error != null && <ErrorLine error={error} onRetry={loadOpts} />}

      {opts && !review && (
        <>
          <Line label="Available" value={`${it.available} ${it.asset}`} />
          <View style={s.row}>
            <TextInput style={[s.input, { flex: 1 }]} value={amount} onChangeText={setAmount} inputMode="decimal"
              placeholder={`Min ${opts.minAmount}`} placeholderTextColor={color.secondary} autoCorrect={false} />
            <Btn title="Max" kind="secondary" onPress={() => setAmount(it.available)} />
          </View>
          {amount !== '' && check && !check.ok && <Text style={[type.footnote, { color: color.danger }]}>{check.error}</Text>}

          <Text style={[type.footnote, { marginTop: space.m }]}>Send to</Text>
          <View>
            {opts.destinations.map((d) => {
              const on = dest === d.id;
              const I = on ? RadioButtonIcon : CircleIcon;
              return (
                <Pressable key={d.id} onPress={() => setDest(d.id)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                  style={[s.row, s.divider, { justifyContent: 'flex-start', paddingVertical: space.m }]}>
                  <I size={20} color={on ? color.text : color.secondary} />
                  <Text style={type.body}>{d.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[s.section, { marginTop: space.s }]}>
            <Line label="Fee" value={`${opts.fee} ${asset}`} />
            <Line label="You receive" value={check?.ok ? `${fromUnits(check.receive, it.decimals)} ${asset}` : '—'} strong />
          </View>
          {isBusy && <Text style={[type.footnote, { color: color.text }]}>A claim for {asset} is still in progress. Wait for it to finish.</Text>}
          <Btn title="Review" disabled={!check?.ok || !dest || isBusy || !fresh} onPress={() => setReview(true)} style={{ marginTop: space.s }} />
        </>
      )}

      {opts && review && dest && (
        <>
          {/* The balance refreshes every 15 s; if it drops below the amount, say so instead of rendering nothing. */}
          {check?.ok ? (
            <>
              <View style={s.section}>
                <Line label="Amount" value={`${check.amount} ${asset}`} />
                <Line label="Fee" value={`−${opts.fee} ${asset}`} />
                <Line label="To" value={opts.destinations.find((d) => d.id === dest)?.label ?? dest} />
              </View>
              <View style={s.section}>
                <Line label="You receive" value={`${fromUnits(check.receive, it.decimals)} ${asset}`} strong />
              </View>
              <Btn title="Confirm and claim" disabled={sent} style={{ marginTop: space.s }}
                onPress={() => {
                  setSent(true);
                  router.replace(`/status/${claims.submit({ asset, amount: check.amount, destinationId: dest })}`);
                }} />
            </>
          ) : (
            <Text style={[type.footnote, { color: color.danger }]}>{check?.error ?? 'This claim is no longer valid'}. Edit the amount to continue.</Text>
          )}
          <Btn title="Edit" kind="secondary" disabled={sent} onPress={() => setReview(false)} />
        </>
      )}
    </Page>
  );
}
