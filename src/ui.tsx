import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { CheckCircleIcon, CircleNotchIcon, WarningCircleIcon, XIcon } from 'phosphor-react-native';
import { ApiError, type Activity } from './api';
import type { Tracked } from './claims';
import { color, hairline, num, space, type } from './theme';

export const errText = (e: unknown) =>
  e instanceof ApiError && e.status === 401 ? 'Your token is invalid or expired. Use Change token on the Balance screen.'
    : e instanceof Error ? e.message : String(e);
export const activityLabel = (a: Activity) => a.type[0].toUpperCase() + a.type.slice(1);
export const unresolved = (t: Tracked) => !t.error && (!t.claim || t.claim.status === 'pending');

export function Page({ children }: { children: React.ReactNode }) {
  return <ScrollView style={{ flex: 1, backgroundColor: color.bg }} contentContainerStyle={s.page} contentInsetAdjustmentBehavior="automatic">{children}</ScrollView>;
}

// iOS shows the native large title and Android the app bar title; only web draws it in content.
export const Title = ({ children }: { children: string }) =>
  Platform.OS === 'web' ? <Text style={[type.largeTitle, { marginBottom: space.s }]} accessibilityRole="header">{children}</Text> : null;

export const Line = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <View style={s.row}>
    <Text style={type.footnote}>{label}</Text>
    <Text style={[strong ? type.bodyStrong : type.body, num, s.value]} selectable>{value}</Text>
  </View>
);

export function Btn({ title, onPress, disabled, kind = 'primary', style }: {
  title: string; onPress: () => void; disabled?: boolean; kind?: 'primary' | 'secondary' | 'text'; style?: ViewStyle;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}
      style={({ pressed }) => [s[kind], style, (disabled || pressed) && { opacity: disabled ? 0.4 : 0.7 }]}>
      <Text style={[type.bodyStrong, kind === 'primary' && { color: color.onAccent }, kind === 'text' && s.underline]}>{title}</Text>
    </Pressable>
  );
}

export const ErrorLine = ({ error, onRetry }: { error: unknown; onRetry: () => void }) => (
  <View style={{ gap: space.s, alignItems: 'flex-start' }}>
    <Text style={[type.footnote, { color: color.danger }]}>{errText(error)}</Text>
    <Btn title="Retry" kind="secondary" onPress={onRetry} />
  </View>
);

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

export function StateIcon({ t, size = 20 }: { t: Tracked; size?: number }) {
  const { tone } = claimState(t);
  if (unresolved(t)) return <ActivityIndicator size="small" color={color.text} />;
  const I = tone === 'ok' ? CheckCircleIcon : tone === 'bad' ? WarningCircleIcon : CircleNotchIcon;
  return <I size={size} color={color.text} />;
}

export function ClaimBanner({ t, onOpen, onDismiss }: { t: Tracked; onOpen: () => void; onDismiss: () => void }) {
  const st = claimState(t);
  return (
    <Pressable onPress={onOpen} style={[s.row, s.divider, { alignItems: 'flex-start', paddingVertical: space.m }]}>
      <View style={{ paddingTop: 1 }}><StateIcon t={t} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.bodyStrong}>{st.title}</Text>
        <Text style={type.footnote}>{st.detail}</Text>
      </View>
      {!unresolved(t) && (
        <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={8}>
          <XIcon size={18} color={color.secondary} />
        </Pressable>
      )}
    </Pressable>
  );
}

export const s = StyleSheet.create({
  column: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: space.l }, // shared by page and web header
  page: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: space.l, paddingTop: space.s, paddingBottom: space.xxl, gap: space.m, flexGrow: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.m },
  value: { flexShrink: 1, textAlign: 'right' },
  divider: { borderBottomWidth: hairline, borderColor: color.hairline },
  section: { borderTopWidth: hairline, borderColor: color.hairline, paddingTop: space.m, gap: space.s },
  input: { ...type.body, ...num, borderWidth: hairline, borderColor: color.secondary, borderRadius: 8, paddingHorizontal: space.m, height: 48 },
  primary: { backgroundColor: color.accent, borderRadius: 10, height: 48, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center' },
  secondary: { borderWidth: hairline, borderColor: color.text, borderRadius: 10, height: 40, paddingHorizontal: space.l, alignItems: 'center', justifyContent: 'center' },
  text: { paddingVertical: space.xs },
  underline: { textDecorationLine: 'underline' },
});
