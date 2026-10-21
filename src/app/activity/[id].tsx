import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CaretRightIcon } from 'phosphor-react-native';
import { api, type Claim } from '../../api';
import { activityCache } from '../../store';
import { color, num, space, type } from '../../theme';
import { activityLabel, Line, Page, s, Title } from '../../ui';

export default function ActivityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const a = activityCache.get(id);
  const [claim, setClaim] = useState<Claim | null>(null);

  // A claim row may point at its claim (relatedId) or be the claim itself; extra details are best effort.
  useEffect(() => {
    if (a?.type !== 'claim') return;
    api.claim(a.relatedId ?? a.id).then(setClaim, () => {});
  }, [a]);

  // Reload on this URL: the list hasn't been fetched, and there is no endpoint for a single item.
  if (!a) return (
    <Page>
      <Title>Details</Title>
      <Text style={type.body}>Open this item from Activity to see its details.</Text>
    </Page>
  );

  const related = a.relatedId ? activityCache.get(a.relatedId) : undefined;
  return (
    <Page>
      <Title>{activityLabel(a)}</Title>
      <Text style={type.figure} selectable>{a.amount} {a.asset}</Text>

      <View style={[s.section, { marginTop: space.s }]}>
        <Line label="Status" value={a.status[0].toUpperCase() + a.status.slice(1)} />
        <Line label="Date" value={new Date(a.createdAt).toLocaleString()} />
        {a.exchange && <Line label="Exchange" value={a.exchange} />}
        <Line label="ID" value={a.id} />
      </View>

      {claim && (
        <View style={s.section}>
          <Line label="Fee" value={`${claim.fee} ${claim.asset}`} />
          {claim.status !== 'failed' && (
            <Line label={claim.status === 'completed' ? 'Received' : 'You receive'} value={`${claim.receiveAmount} ${claim.asset}`} strong />
          )}
          <Line label="Destination" value={claim.destinationId} />
          {claim.failureReason && <Text style={[type.footnote, { color: color.danger }]}>{claim.failureReason}</Text>}
        </View>
      )}

      {related && (
        <Pressable onPress={() => router.push(`/activity/${related.id}`)} accessibilityRole="link"
          style={[s.row, s.section, s.divider, { paddingBottom: space.m }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={type.footnote}>Related</Text>
            <Text style={type.bodyStrong}>{activityLabel(related)} · <Text style={num}>{related.amount} {related.asset}</Text></Text>
          </View>
          <CaretRightIcon size={16} color={color.secondary} />
        </Pressable>
      )}
      {a.relatedId && !related && <Line label="Related ID" value={a.relatedId} />}
    </Page>
  );
}
