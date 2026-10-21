import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { api, type Activity } from '../api';
import { color, num, space, type } from '../theme';
import { Btn, ErrorLine, s, Title } from '../ui';

export default function ActivityScreen() {
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
    <FlatList
      style={{ flex: 1, backgroundColor: color.bg }}
      contentContainerStyle={s.page}
      contentInsetAdjustmentBehavior="automatic"
      ListHeaderComponent={<Title>Activity</Title>}
      data={items}
      keyExtractor={(a) => a.id}
      onEndReached={() => { if (error == null) more(); }} // after an error, only the Retry button reloads
      onEndReachedThreshold={0.5}
      renderItem={({ item: a }) => (
        <View style={[s.row, s.divider, { paddingVertical: space.m }]}>
          <View style={{ flexShrink: 1, gap: 2 }}>
            <Text style={type.bodyStrong}>{a.type[0].toUpperCase() + a.type.slice(1)}{a.exchange ? ` · ${a.exchange}` : ''}</Text>
            <Text style={[type.footnote, num]}>{new Date(a.createdAt).toLocaleString()} · {a.status}</Text>
          </View>
          <Text style={[type.bodyStrong, num]}>{a.amount} {a.asset}</Text>
        </View>
      )}
      ListFooterComponent={
        error != null ? <ErrorLine error={error} onRetry={more} />
        : loading ? <ActivityIndicator color={color.text} style={{ alignSelf: 'flex-start', marginVertical: space.l }} />
        : cursor === null ? (items.length
          ? <Text style={[type.footnote, { marginVertical: space.l }]}>End of history</Text>
          : <Text style={[type.body, { textAlign: 'center', color: color.secondary, marginTop: space.xxl }]}>No activity yet</Text>)
        : <Btn title="Load more" kind="secondary" onPress={more} style={{ alignSelf: 'flex-start', marginTop: space.m }} />
      }
    />
  );
}
