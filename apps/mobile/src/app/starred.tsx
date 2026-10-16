import { router } from 'expo-router';
import { FlatList, Pressable, View } from 'react-native';

import { previewOf } from '@/components/ChatRow';
import { Avatar, EmptyState, Header, Icon, T } from '@/components/ui';
import { inboxTime } from '@neva/core';
import { useStore } from '@/store';
import { useTheme } from '@/theme';

export default function Starred() {
  const t = useTheme();
  const messages = useStore((s) => s.messages);
  const conversations = useStore((s) => s.conversations);
  const users = useStore((s) => s.users);
  const meId = useStore((s) => s.meId);
  const starred = Object.values(messages).flat().filter((m) => m.starred && !m.deleted).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="Starred messages" />
      <FlatList
        data={starred}
        keyExtractor={(m) => m.id}
        renderItem={({ item: m }) => {
          const conv = conversations[m.conversationId];
          const sender = users[m.senderId];
          const other = conv ? users[conv.participantId] : undefined;
          return (
            <Pressable onPress={() => router.push(`/chat/${m.conversationId}`)} style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 14, backgroundColor: pressed ? t.surface2 : 'transparent' })}>
              <Avatar user={sender} size={40} />
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row' }}>
                  <T weight="600" size={14} style={{ flex: 1 }}>{m.senderId === meId ? `You → ${other?.displayName}` : sender?.displayName}</T>
                  <T faint size={12}>{inboxTime(m.createdAt)}</T>
                </View>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <Icon name="star" size={13} color={t.textDim} />
                  <T dim numberOfLines={2} style={{ flex: 1 }}>{previewOf(m, meId).text}</T>
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={<EmptyState icon="star-outline" title="No starred messages" body="Long-press any message and tap Star to keep it here — handy for prices, addresses and serials." />}
      />
    </View>
  );
}
