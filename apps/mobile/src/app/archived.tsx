import { useState } from 'react';
import { Alert, FlatList, View } from 'react-native';

import { ChatRow } from '@/components/ChatRow';
import { Sheet } from '@/components/Sheet';
import { EmptyState, Header, Icon, T } from '@/components/ui';
import type { Conversation } from '@neva/core';
import { showToast, useStore } from '@/store';
import { useTheme } from '@/theme';

export default function Archived() {
  const t = useTheme();
  const conversations = useStore((s) => s.conversations);
  const setArchived = useStore((s) => s.setArchived);
  const deleteConversation = useStore((s) => s.deleteConversation);
  const [target, setTarget] = useState<Conversation | null>(null);
  const list = Object.values(conversations).filter((c) => c.status === 'archived').sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="Archived" />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 }}>
        <Icon name="information-circle-outline" size={16} color={t.textDim} />
        <T dim size={12.5} style={{ flex: 1 }}>Archived chats come back to your inbox when you get a new message, unless they’re muted.</T>
      </View>
      <FlatList data={list} keyExtractor={(c) => c.id} renderItem={({ item }) => <ChatRow conv={item} onLongPress={setTarget} />} ListEmptyComponent={<EmptyState icon="archive-outline" title="No archived chats" body="Swipe left on a chat to archive it." />} />
      <Sheet
        visible={!!target}
        onClose={() => setTarget(null)}
        actions={target ? [
          { label: 'Unarchive', icon: 'archive-outline', onPress: () => setArchived(target.id, false) },
          { label: 'Delete chat', icon: 'trash-outline', danger: true, onPress: () => { const id = target.id; Alert.alert('Delete this chat?', 'Messages are removed from this device. This can’t be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { deleteConversation(id); showToast('Chat deleted', 'trash-outline'); } }]); } },
        ] : []}
      />
    </View>
  );
}
