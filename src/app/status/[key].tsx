import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useApp } from '../../store';
import { num, space, type } from '../../theme';
import { Btn, claimState, Page, StateIcon, Title } from '../../ui';

export default function Status() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { claims } = useApp();
  const t = claims.list.find((x) => x.key === key);
  if (!t) return <Page><Title>Claim status</Title><Text style={type.body}>This claim is not tracked on this device. Check Activity.</Text></Page>;
  const st = claimState(t);
  return (
    <Page>
      <Title>Claim status</Title>
      <View style={{ flexDirection: 'row', gap: space.m, alignItems: 'center' }}>
        <StateIcon t={t} size={24} />
        <Text style={type.title}>{st.title}</Text>
      </View>
      <Text style={type.body}>{st.detail}</Text>
      {t.claim && <Text style={[type.footnote, num]} selectable>Claim ID {t.claim.id}</Text>}
      {t.unknown && !t.claim && <Btn title="Check now" kind="secondary" onPress={() => claims.send(t)} style={{ alignSelf: 'flex-start' }} />}
    </Page>
  );
}
