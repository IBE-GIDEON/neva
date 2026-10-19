import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatRow } from '@/components/ChatRow';
import { Sheet, type SheetAction } from '@/components/Sheet';
import { Avatar, BrandMark, Chip, EmptyState, Icon, IconButton, T, Tap, VerifiedTick } from '@/components/ui';
import type { Conversation } from '@neva/core';
import { useShallow } from 'zustand/react/shallow';

import { showToast, useStore } from '@/store';
import { useTheme } from '@/theme';

type Filter = 'all' | 'unread' | 'offers' | 'pinned';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'offers', label: 'Offers' },
  { key: 'pinned', label: 'Pinned' },
];

const EMPTY: Record<Filter, { icon: any; title: string; body: string }> = {
  all: { icon: 'chatbubbles-outline', title: 'No conversations yet', body: 'Message a seller from any listing, or find people by @username. The item stays attached to the chat.' },
  unread: { icon: 'checkmark-done-outline', title: 'You’re all caught up', body: 'New messages will show up here.' },
  offers: { icon: 'pricetag-outline', title: 'No open offers', body: 'Offers waiting for a response — yours or theirs — appear here.' },
  pinned: { icon: 'pin-outline', title: 'Nothing pinned', body: 'Swipe right on a chat to pin it to the top.' },
};

export default function Chats() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const conversations = useStore((s) => s.conversations);
  const users = useStore((s) => s.users);
  // Only the ids with an open offer — avoids re-rendering the inbox on every message tick.
  const offerIds = useStore(useShallow((s) => Object.keys(s.conversations).filter((id) => (s.messages[id] ?? []).some((m) => m.type === 'offer' && m.offer?.state === 'pending'))));
  const notifUnread = useStore((s) => s.notifications.filter((n) => !n.read).length);
  const { togglePin, toggleMute, markUnread, markRead, setArchived, deleteConversation, toggleBlock } = useStore.getState();

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState(false);
  const [target, setTarget] = useState<Conversation | null>(null);

  const archivedCount = Object.values(conversations).filter((c) => c.status === 'archived').length;
  const archivedUnread = Object.values(conversations).filter((c) => c.status === 'archived' && c.unread > 0).length;

  const hasOpenOffer = (cid: string) => offerIds.includes(cid);
  const active = Object.values(conversations).filter((c) => c.status !== 'archived');
  const counts: Record<Filter, number> = {
    all: active.length,
    unread: active.filter((c) => c.unread > 0).length,
    offers: active.filter((c) => hasOpenOffer(c.id)).length,
    pinned: active.filter((c) => c.pinned).length,
  };

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const uq = q.replace(/^@/, '');
    return Object.values(conversations)
      .filter((c) => c.status !== 'archived')
      .filter((c) => {
        if (filter === 'unread') return c.unread > 0;
        if (filter === 'pinned') return c.pinned;
        if (filter === 'offers') return hasOpenOffer(c.id);
        return true;
      })
      .filter((c) => {
        if (!q) return true;
        const u = users[c.participantId];
        return u?.displayName.toLowerCase().includes(q) || (!!uq && !!u?.username?.toLowerCase().includes(uq)) || c.listingSnapshot?.title.toLowerCase().includes(q) || (useStore.getState().messages[c.id] ?? []).some((m) => m.body?.toLowerCase().includes(q));
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.lastMessageAt - a.lastMessageAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, filter, query, users, offerIds]);

  // Like WhatsApp: the main search also finds people you haven't chatted with yet (by @username or name).
  const people = useMemo(() => {
    const q = query.trim();
    if (q.replace(/^@/, '').length < 2) return [];
    const chatWith = new Set(Object.values(conversations).filter((c) => c.status !== 'archived').map((c) => c.participantId));
    return useStore.getState().searchPeople(q).filter((u) => !chatWith.has(u.id));
  }, [query, users, conversations]);
  const startChat = (id: string) => {
    setQuery('');
    router.push(`/chat/${useStore.getState().startConversation(id)}`);
  };

  const confirmDelete = (id: string) =>
    Alert.alert('Delete this chat?', 'Messages are removed from this device. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteConversation(id); showToast('Chat deleted', 'trash-outline'); } },
    ]);

  const actions: SheetAction[] = target
    ? [
        { label: target.pinned ? 'Unpin' : 'Pin', icon: 'pin-outline', onPress: () => togglePin(target.id) },
        { label: target.unread ? 'Mark as read' : 'Mark as unread', icon: 'mail-unread-outline', onPress: () => (target.unread ? markRead(target.id) : markUnread(target.id)) },
        { label: target.muted ? 'Unmute' : 'Mute', icon: 'notifications-off-outline', onPress: () => toggleMute(target.id) },
        { label: 'Archive', icon: 'archive-outline', onPress: () => { setArchived(target.id, true); showToast('Chat archived', 'archive-outline'); } },
        { label: 'View profile', icon: 'person-circle-outline', onPress: () => router.push(`/seller/${target.participantId}`) },
        { label: 'Block', icon: 'ban-outline', danger: true, onPress: () => { toggleBlock(target.participantId); showToast('Blocked', 'ban-outline'); } },
        { label: 'Delete chat', icon: 'trash-outline', danger: true, onPress: () => confirmDelete(target.id) },
      ]
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 54, gap: 9 }}>
          <BrandMark size={28} />
          <Text style={{ color: t.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.7, flex: 1 }}>neva</Text>
          <IconButton name="notifications-outline" badge={notifUnread} onPress={() => router.push('/notifications')} />
          <IconButton name="create-outline" onPress={() => router.push('/new-chat')} />
          <IconButton name="ellipsis-horizontal" onPress={() => setMenu(true)} style={{ marginRight: -8 }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.surface2, borderRadius: 11, paddingHorizontal: 12, height: 38, marginTop: 2 }}>
          <Icon name="search" size={17} color={t.textDim} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search" placeholderTextColor={t.textDim} style={{ flex: 1, color: t.text, fontSize: 15.5, paddingVertical: 0 }} />
          {!!query && <IconButton name="close-circle" size={17} color={t.textDim} onPress={() => setQuery('')} style={{ padding: 2 }} />}
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <View>
            {counts.all > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, gap: 8 }}>
                {FILTERS.map((f) => (
                  <Chip key={f.key} label={f.key !== 'all' && counts[f.key] ? `${f.label} ${counts[f.key]}` : f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
                ))}
              </ScrollView>
            )}
            {archivedCount > 0 && filter === 'all' && !query && (
              <Pressable onPress={() => router.push('/archived')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: pressed ? t.surface : 'transparent' })}>
                <View style={{ width: 56, alignItems: 'center' }}>
                  <Icon name="archive-outline" size={22} color={t.textDim} />
                </View>
                <T weight="500" style={{ flex: 1 }}>Archived</T>
                {archivedUnread > 0 && <T weight="600" size={13} color={t.primary}>{archivedUnread}</T>}
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item }) => <ChatRow conv={item} onLongPress={setTarget} />}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={9}
        removeClippedSubviews
        ListEmptyComponent={
          people.length ? null : <EmptyState
            icon={query ? 'search-outline' : EMPTY[filter].icon}
            title={query ? 'No results' : EMPTY[filter].title}
            body={query ? (query.trim().replace(/^@/, '').length < 2 ? 'Type at least 2 letters to search people too.' : 'No chats or people match. Check the @username spelling.') : EMPTY[filter].body}
            action={!query && filter === 'all' ? <Tap onPress={() => router.navigate('/(tabs)/explore')} style={{ marginTop: 12, paddingHorizontal: 18, height: 38, justifyContent: 'center', borderRadius: 10, backgroundColor: t.inverse }}><T weight="600" size={14} color={t.inverseText}>Browse Explore</T></Tap> : undefined}
          />
        }
        ListFooterComponent={
          people.length ? (
            <View>
              <T faint size={12.5} weight="600" style={{ paddingHorizontal: 16, paddingTop: list.length ? 18 : 6, paddingBottom: 6, letterSpacing: 0.4 }}>PEOPLE ON NEVA</T>
              {people.map((u) => (
                <Pressable key={u.id} onPress={() => startChat(u.id)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: pressed ? t.surface : 'transparent' })}>
                  <Avatar user={u} size={48} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <T weight="600">{u.displayName}</T>
                      <VerifiedTick user={u} />
                    </View>
                    <T faint size={13}>@{u.username}{u.city ? ` · ${u.city}` : ''}</T>
                  </View>
                  <Icon name="chatbubble-outline" size={18} color={t.textDim} />
                </Pressable>
              ))}
            </View>
          ) : list.length ? (
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 22, paddingHorizontal: 30 }}>
              <Icon name="lock-closed-outline" size={12} color={t.textFaint} />
              <T faint size={12} center>Inspect before you pay. Off-app payments aren’t protected.</T>
            </View>
          ) : null
        }
      />

      <Sheet visible={!!target} onClose={() => setTarget(null)} title={target ? users[target.participantId]?.displayName : ''} actions={actions} />
      <Sheet
        visible={menu}
        onClose={() => setMenu(false)}
        actions={[
          { label: 'New chat', icon: 'create-outline', onPress: () => router.push('/new-chat') },
          { label: 'Starred messages', icon: 'star-outline', onPress: () => router.push('/starred') },
          { label: 'Saved items', icon: 'bookmark-outline', onPress: () => router.push('/saved') },
          { label: 'Mark all as read', icon: 'checkmark-done-outline', onPress: () => Object.keys(conversations).forEach(markRead) },
          { label: 'Settings', icon: 'settings-outline', onPress: () => router.push('/settings') },
        ]}
      />
    </View>
  );
}
