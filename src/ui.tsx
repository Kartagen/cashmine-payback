import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { CheckCircleIcon, CircleNotchIcon, WarningCircleIcon, XIcon } from 'phosphor-react-native';
import { ApiError, type Activity } from './api';
import type { Tracked } from './claims';
import { claimState, unresolved } from './claimState';
import { color, hairline, num, space, type } from './theme';

export { claimState, unresolved }; // pure, in their own file so Node tests can import them

export const errText = (e: unknown) =>
  e instanceof ApiError && e.status === 401 ? 'Your token is invalid or expired. Use Change token on the Balance screen.'
    : e instanceof Error ? e.message : String(e);
export const activityLabel = (a: Activity) => a.type[0].toUpperCase() + a.type.slice(1);

// Web: reserve the scrollbar's space on both edges, so the centered column doesn't shift when content starts to overflow.
export const gutter = (Platform.OS === 'web' ? { scrollbarGutter: 'stable both-edges' } : {}) as ViewStyle;
export const scrollStyle: ViewStyle = { flex: 1, backgroundColor: color.bg, ...gutter };

export const Loader = () => (
  <View style={{ alignItems: 'center', paddingVertical: space.xxl }}><ActivityIndicator color={color.text} /></View>
);

export function Page({ children }: { children: React.ReactNode }) {
  return <ScrollView style={scrollStyle} contentContainerStyle={s.page} contentInsetAdjustmentBehavior="automatic">{children}</ScrollView>;
}

// iOS shows the native large title and Android the app bar title; only web draws it in content,
// and names the browser tab after it (on focus, so it's right again after Back).
export function Title({ children }: { children: string }) {
  useFocusEffect(useCallback(() => { if (Platform.OS === 'web') document.title = `${children} · CashMine`; }, [children]));
  return Platform.OS === 'web' ? <Text style={[type.largeTitle, { marginBottom: space.s }]} accessibilityRole="header">{children}</Text> : null;
}

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
