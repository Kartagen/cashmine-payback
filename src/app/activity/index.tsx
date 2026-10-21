import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CaretRightIcon } from 'phosphor-react-native';
import { api, type Activity } from '../../api';
import { color, num, space, type } from '../../theme';
import { activityCache } from '../../store';
import { activityLabel, Btn, ErrorLine, Loader, s, scrollStyle, Title } from '../../ui';

export default function ActivityScreen() {
  const [items, setItems] = useState<Activity[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined); // undefined = first page, null = end
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const busy = useRef(false); // sync guard: on mount, the effect and onEndReached both call more() before `loading` updates
  const more = useCallback(async () => {
    if (busy.current || cursor === null) return;
    busy.current = true;
    setLoading(true); setError(null);
    try {
      const page = await api.activity(cursor);
      page.items.forEach((a) => activityCache.set(a.id, a));
      setItems((l) => [...l, ...page.items]);
      setCursor(page.nextCursor);
    } catch (e) {
      setError(e);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [cursor]);
  useEffect(() => { more(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <FlatList
      style={scrollStyle}
      contentContainerStyle={s.page}
      contentInsetAdjustmentBehavior="automatic"
      ListHeaderComponent={<Title>Activity</Title>}
      data={items}
      keyExtractor={(a) => a.id}
      onEndReached={() => { if (error == null) more(); }} // after an error, only the Retry button reloads
      onEndReachedThreshold={0.5}
      renderItem={({ item: a }) => (
        <Pressable onPress={() => router.push(`/activity/${a.id}`)} accessibilityRole="link"
          style={({ pressed }) => [s.row, s.divider, { paddingVertical: space.m }, pressed && { opacity: 0.6 }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={type.bodyStrong}>{activityLabel(a)}{a.exchange ? ` · ${a.exchange}` : ''}</Text>
            <Text style={[type.footnote, num]}>{new Date(a.createdAt).toLocaleString()} · {a.status}</Text>
          </View>
          <Text style={[type.bodyStrong, num]}>{a.amount} {a.asset}</Text>
          <CaretRightIcon size={16} color={color.secondary} />
        </Pressable>
      )}
      ListFooterComponent={
        error != null ? <ErrorLine error={error} onRetry={more} />
        : loading ? <Loader />
        : cursor === null ? (items.length
          ? <Text style={[type.footnote, { marginVertical: space.l }]}>End of history</Text>
          : <Text style={[type.body, { textAlign: 'center', color: color.secondary, marginTop: space.xxl }]}>No activity yet</Text>)
        : <Btn title="Load more" kind="secondary" onPress={more} style={{ alignSelf: 'flex-start', marginTop: space.m }} />
      }
    />
  );
}
