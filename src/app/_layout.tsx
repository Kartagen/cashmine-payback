import { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { CaretLeftIcon } from 'phosphor-react-native';
import { getToken, setToken } from '../api';
import { AppProvider } from '../store';
import { color, type } from '../theme';
import { Btn, gutter, Page, s } from '../ui';

const web = Platform.OS === 'web';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ // local copies: Vercel skips node_modules paths, so fonts can't be served from the package
    Inter_400Regular: require('../../assets/fonts/Inter_400Regular.ttf'),
    Inter_500Medium: require('../../assets/fonts/Inter_500Medium.ttf'),
    Inter_600SemiBold: require('../../assets/fonts/Inter_600SemiBold.ttf'),
  });
  const [hasToken, setHasToken] = useState(!!getToken());
  if (!fontsLoaded && !fontError) return null;
  return (
    <>
      <StatusBar style="dark" />
      {!hasToken ? <TokenGate onDone={() => setHasToken(true)} /> : (
        <AppProvider>
          <Stack screenOptions={{
            headerLargeTitle: true, // iOS; Android keeps its Material app bar and system back
            headerLargeTitleShadowVisible: false,
            headerShadowVisible: false,
            headerStyle: { backgroundColor: color.bg },
            headerTintColor: color.text,
            headerTitleStyle: { fontFamily: type.bodyStrong.fontFamily },
            headerLargeTitleStyle: { fontFamily: type.largeTitle.fontFamily },
            contentStyle: { backgroundColor: color.bg },
            ...(web && { header: () => <WebHeader /> }), // web draws the large title in content (see Title)
          }}>
            <Stack.Screen name="index" options={{ title: 'Balance', headerShown: !web }} />
            <Stack.Screen name="claim/[asset]" options={{ title: 'Claim' }} />
            <Stack.Screen name="status/[key]" options={{ title: 'Claim status' }} />
            <Stack.Screen name="activity/index" options={{ title: 'Activity' }} />
            <Stack.Screen name="activity/[id]" options={{ title: 'Details' }} />
          </Stack>
        </AppProvider>
      )}
    </>
  );
}

// Same column as the page, so Back lines up with the content instead of the window edge.
const WebHeader = () => (
  <View style={[gutter, { backgroundColor: color.bg, overflow: 'hidden' }]}>{/* same gutter as the page scroller */}
    <View style={[s.column, { height: 44, justifyContent: 'center' }]}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={{ alignSelf: 'flex-start', marginLeft: -4 }}>
        <CaretLeftIcon size={24} color={color.text} />
      </Pressable>
    </View>
  </View>
);

// Tokens are printable ASCII; strip whitespace and zero-width chars that sneak in when copying from email.
const cleanToken = (t: string) => t.replace(/[\s\u200B-\u200D\uFEFF]/g, '');
const validToken = (t: string) => /^[\x21-\x7E]+$/.test(t);

function TokenGate({ onDone }: { onDone: () => void }) {
  const [t, setT] = useState('');
  const clean = cleanToken(t);
  return (
    <Page>
      <Text style={[type.largeTitle, { marginTop: 48 }]}>CashMine</Text>
      <Text style={type.footnote}>Paste your API token. It is stored only in this browser.</Text>
      <TextInput style={s.input} value={t} onChangeText={setT} placeholder="ct1…" placeholderTextColor={color.secondary}
        autoCapitalize="none" autoCorrect={false} autoComplete="off" spellCheck={false} secureTextEntry />
      {clean !== '' && !validToken(clean) && <Text style={[type.footnote, { color: color.danger }]}>The token contains invalid characters.</Text>}
      <Btn title="Continue" disabled={!validToken(clean)} onPress={() => (setToken(clean), onDone())} />
    </Page>
  );
}
