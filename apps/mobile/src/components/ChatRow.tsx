import { Image } from 'expo-image';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import type { Conversation, Message } from '@neva/core';
import { formatNaira, inboxTime } from '@neva/core';
import { isStoryLive, useLive, useStore } from '@/store';
import { useTheme } from '@/theme';
import { Avatar, Badge, haptic, Icon, VerifiedTick } from './ui';

export function previewOf(m: Message | undefined, meId: string): { text: string; icon?: any } {
  if (!m) return { text: 'Start the conversation' };
  if (m.deleted) return { text: m.senderId === meId ? 'You deleted this message' : 'This message was deleted', icon: 'ban-outline' };
  switch (m.type) {
    case 'image':
      return { text: m.body || 'Photo', icon: 'image-outline' };
    case 'offer':
      return { text: `Offer ${formatNaira(m.offer!.amountMinor)} · ${m.offer!.state}`, icon: 'pricetag-outline' };
    case 'voice':
      return { text: `Voice message · 0:${String(m.voice?.seconds ?? 0).padStart(2, '0')}`, icon: 'mic-outline' };
    case 'story_reply':
      return { text: m.body ?? 'Replied to a status' };
    case 'system':
      return { text: m.body ?? '' };
    case 'listing':
      return { text: m.body ?? 'Shared a listing' };
    default:
      return { text: m.body ?? '' };
  }
}

export function Ticks({ status, size = 16, onBubble }: { status: Message['status']; size?: number; onBubble?: boolean }) {
  const t = useTheme();
  const readReceipts = useStore((s) => s.settings.readReceipts);
  const dim = onBubble ? 'rgba(255,255,255,0.7)' : t.textFaint;
  const read = onBubble ? '#FFFFFF' : t.primary;
  if (status === 'pending') return <Icon name="time-outline" size={size - 3} color={dim} />;
  if (status === 'failed') return <Icon name="alert-circle" size={size - 2} color={t.danger} />;
  if (status === 'sent') return <Icon name="checkmark" size={size} color={dim} />;
  return <Icon name="checkmark-done" size={size} color={status === 'read' && readReceipts ? read : dim} />;
}

export const ChatRow = memo(function ChatRow({ conv, onLongPress }: { conv: Conversation; onLongPress: (c: Conversation) => void }) {
  const t = useTheme();
  const user = useStore((s) => s.users[conv.participantId]);
  const meId = useStore((s) => s.meId);
  const last = useStore((s) => s.messages[conv.id]?.[s.messages[conv.id]!.length - 1]);
  const hasStory = useStore((s) => s.stories.some((st) => st.userId === conv.participantId && isStoryLive(st)));
  const storySeen = useStore((s) => s.stories.filter((st) => st.userId === conv.participantId && isStoryLive(st)).every((st) => s.viewedStories.includes(st.id)));
  const blocked = useStore((s) => s.blocked.includes(conv.participantId));
  const typing = useLive((s) => s.typing[conv.id]);
  const setArchived = useStore((s) => s.setArchived);
  const togglePin = useStore((s) => s.togglePin);
  const p = previewOf(last, meId);
  const unread = conv.unread > 0;

  const action = (label: string, icon: any, bg: string, fg: string, fn: () => void) => (
    <Pressable onPress={() => { haptic.medium(); fn(); }} style={{ width: 84, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <Icon name={icon} size={21} color={fg} />
      <Text style={{ color: fg, fontSize: 12, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );

  return (
    <ReanimatedSwipeable
      friction={2}
      overshootRight={false}
      overshootLeft={false}
      renderRightActions={() => action(conv.status === 'archived' ? 'Unarchive' : 'Archive', 'archive-outline', t.surface3, t.text, () => setArchived(conv.id, conv.status !== 'archived'))}
      renderLeftActions={() => action(conv.pinned ? 'Unpin' : 'Pin', 'pin-outline', t.primary, '#fff', () => togglePin(conv.id))}>
      <Pressable
        onPress={() => router.push(`/chat/${conv.id}`)}
        onLongPress={() => { haptic.medium(); onLongPress(conv); }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 9, gap: 12, backgroundColor: pressed ? t.surface : t.bg })}>
        <Avatar user={user} size={56} ring={hasStory} ringSeen={storySeen} online={user?.online && !hasStory} onPress={hasStory ? () => router.push(`/story/${conv.participantId}`) : undefined} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text numberOfLines={1} style={{ color: t.text, fontSize: 16, fontWeight: unread ? '600' : '500', flexShrink: 1, letterSpacing: -0.15 }}>{user?.displayName}</Text>
            <VerifiedTick user={user} size={13} />
            <View style={{ flex: 1 }} />
            <Text style={{ color: unread ? t.text : t.textFaint, fontSize: 12.5, fontWeight: unread ? '600' : '400' }}>{inboxTime(conv.lastMessageAt)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {typing ? (
              <Text style={{ color: t.primary, fontSize: 14.5, flex: 1 }}>typing…</Text>
            ) : blocked ? (
              <Text style={{ color: t.textFaint, fontSize: 14.5, flex: 1 }}>Blocked</Text>
            ) : conv.draft ? (
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5 }}>
                <Text style={{ color: t.danger }}>Draft · </Text>
                <Text style={{ color: t.textDim }}>{conv.draft}</Text>
              </Text>
            ) : (
              <>
                {last?.senderId === meId && !last.deleted && <Ticks status={last.status} size={15} />}
                {p.icon && <Icon name={p.icon} size={14} color={t.textDim} />}
                <Text numberOfLines={1} style={{ color: unread ? t.text : t.textDim, fontSize: 14.5, flex: 1, fontWeight: unread ? '500' : '400' }}>{p.text}</Text>
              </>
            )}
            {conv.muted && <Icon name="notifications-off-outline" size={14} color={t.textFaint} />}
            {conv.pinned && <Icon name="pin" size={13} color={t.textFaint} />}
            <Badge count={conv.unread} muted={conv.muted} />
          </View>
          {conv.listingSnapshot && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Image source={{ uri: conv.listingSnapshot.image }} style={{ width: 16, height: 16, borderRadius: 4 }} />
              <Text numberOfLines={1} style={{ color: t.textFaint, fontSize: 12, flex: 1 }}>
                {conv.listingSnapshot.title} · {formatNaira(conv.listingSnapshot.priceMinor)}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
});
