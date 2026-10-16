import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Share, TextInput, View } from 'react-native';

import { Avatar, EmptyState, Header, Icon, type IconName, T, VerifiedTick } from '@/components/ui';
import type { Profile } from '@neva/core';
import { useStore } from '@/store';
import { useTheme } from '@/theme';

/**
 * Start a DM. Discovery and inbox stay separate (blueprint §3): you message people you follow,
 * have talked to, or find by their @username — never a browsable directory of strangers.
 */
export default function NewChat() {
  const t = useTheme();
  const users = useStore((s) => s.users);
  const me = useStore((s) => s.users[s.meId]);
  const follows = useStore((s) => s.follows);
  const conversations = useStore((s) => s.conversations);
  const blocked = useStore((s) => s.blocked);
  const searchPeople = useStore((s) => s.searchPeople);
  const startConversation = useStore((s) => s.startConversation);
  const [q, setQ] = useState('');

  const query = q.trim();
  const results = useMemo(() => (query.length >= 2 ? searchPeople(query) : []), [query, searchPeople, users]);

  const known = useMemo(() => {
    const ids = new Set([...follows, ...Object.values(conversations).map((c) => c.participantId)]);
    return Array.from(ids)
      .map((id) => users[id])
      .filter((u): u is Profile => !!u && !blocked.includes(u.id))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [follows, conversations, users, blocked]);

  const shareMe = () => Share.share({ message: `Find me on Neva: @${me?.username ?? ''} — search my username to see my shop and message me.` });
  const invite = () => Share.share({ message: 'Join me on Neva — buy and sell gadgets and chat with sellers. Search @' + (me?.username ?? '') + ' when you’re in.' });

  const open = (u: Profile) => router.replace(`/chat/${startConversation(u.id)}`);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="New chat" />
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.surface2, borderRadius: 11, paddingHorizontal: 12, height: 40 }}>
          <Icon name="search" size={17} color={t.textDim} />
          <TextInput
            autoFocus
            value={q}
            onChangeText={setQ}
            placeholder="Search @username or name"
            placeholderTextColor={t.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ flex: 1, color: t.text, fontSize: 15.5, paddingVertical: 0 }}
          />
          {!!q && (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Icon name="close-circle" size={17} color={t.textDim} />
            </Pressable>
          )}
        </View>
      </View>

      {query.length >= 2 ? (
        <FlatList
          data={results}
          keyExtractor={(u) => u.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <PersonRow u={item} onPress={() => open(item)} />}
          ListEmptyComponent={
            <EmptyState
              icon="person-outline"
              title={`No one found for “${query}”`}
              body="Check the spelling of their @username, or invite them to Neva."
            />
          }
          ListFooterComponent={results.length === 0 ? <ActionRow icon="paper-plane-outline" title="Invite to Neva" sub="Share an invite link" onPress={invite} /> : null}
        />
      ) : (
        <FlatList
          data={known}
          keyExtractor={(u) => u.id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={{ paddingTop: 4 }}>
              <ActionRow icon="at-outline" title="Share your username" sub={me ? `People can search @${me.username} to message you` : 'Let people find you'} onPress={shareMe} />
              <ActionRow icon="paper-plane-outline" title="Invite friends" sub="Share an invite link" onPress={invite} />
              <ActionRow icon="compass-outline" title="Find sellers" sub="Browse Explore and message from any listing" onPress={() => router.replace('/(tabs)/explore')} />
              {known.length > 0 && <T dim size={13} weight="500" style={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 }}>Following & recent</T>}
            </View>
          }
          renderItem={({ item }) => <PersonRow u={item} onPress={() => open(item)} />}
        />
      )}
    </View>
  );
}

function PersonRow({ u, onPress }: { u: Profile; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: pressed ? t.surface : 'transparent' })}>
      <Avatar user={u} size={48} online={u.online} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <T weight="500">{u.displayName}</T>
          <VerifiedTick user={u} />
        </View>
        <T dim size={13} numberOfLines={1}>@{u.username}{u.city ? ` · ${u.city}` : ''}</T>
      </View>
      <Icon name="chatbubble-outline" size={20} color={t.textDim} />
    </Pressable>
  );
}

function ActionRow({ icon, title, sub, onPress }: { icon: IconName; title: string; sub: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: pressed ? t.surface : 'transparent' })}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={22} color={t.text} />
      </View>
      <View style={{ flex: 1 }}>
        <T weight="500">{title}</T>
        <T dim size={13}>{sub}</T>
      </View>
    </Pressable>
  );
}
