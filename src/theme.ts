import { Platform, StyleSheet, type TextStyle } from 'react-native';

// The only place colors and type sizes live. See "Design rules" in CLAUDE.md.
export const color = {
  text: '#1A1A1A',
  bg: '#FAF8F5',
  accent: '#D9480F', // primary actions only
  secondary: '#6B6862',
  hairline: 'rgba(26,26,26,0.12)',
  danger: '#B42318', // error text only
  onAccent: '#FFFFFF',
};

export const hairline = StyleSheet.hairlineWidth;
export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };

// Söhne is licensed and not bundled; Inter is the bundled stand-in (loaded in src/app/_layout.tsx).
const font = (inter: string): string =>
  Platform.OS === 'web' ? `Söhne, ${inter}, system-ui, -apple-system, sans-serif` : inter;
const regular = font('Inter_400Regular');
const medium = font('Inter_500Medium');
const semibold = font('Inter_600SemiBold');

export const num: TextStyle = { fontVariant: ['tabular-nums'] };

export const type = StyleSheet.create({
  largeTitle: { fontFamily: semibold, fontSize: 34, lineHeight: 41, letterSpacing: -0.5, color: color.text },
  title: { fontFamily: semibold, fontSize: 20, lineHeight: 25, color: color.text },
  body: { fontFamily: regular, fontSize: 16, lineHeight: 22, color: color.text },
  bodyStrong: { fontFamily: medium, fontSize: 16, lineHeight: 22, color: color.text },
  footnote: { fontFamily: regular, fontSize: 13, lineHeight: 18, color: color.secondary },
  figure: { fontFamily: semibold, fontSize: 34, lineHeight: 41, letterSpacing: -0.5, color: color.text, ...num },
});
