import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bubble, DayPill, TypingBubble } from '@/components/chat/Bubble';
import { Sheet } from '@/components/Sheet';
import { Avatar, Button, Chip, ConditionBadge, haptic, Icon, IconButton, T, Tap, VerifiedTick } from '@/components/ui';
import { QUICK_REPLIES } from '@neva/core';
import type { Message } from '@neva/core';
import { dayLabel, formatNaira, isSameDay, lastSeen } from '@neva/core';
import { isStoryLive, showToast, useLive, useStore } from '@/store';
import { radius, useTheme } from '@/theme';

type Row = { kind: 'msg'; m: Message; first: boolean; last: boolean } | { kind: 'day'; id: string; label: string };

const NO_MESSAGES: Message[] = [];
const EMOJIS = ['👍🏽', '❤️', '😂', '😮', '😢', '🙏🏽', '🔥'];

export default function ChatScreen() {
  const { id, prefill } = useLocalSearchParams<{ id: string; prefill?: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const conv = useStore((s) => s.conversations[id]);
  const user = useStore((s) => (conv ? s.users[conv.participantId] : undefined));
  const messages = useStore((s) => s.messages[id] ?? NO_MESSAGES);
  const listing = useStore((s) => (conv?.listingId ? s.listings[conv.listingId] : undefined));
  const meId = useStore((s) => s.meId);
  const blocked = useStore((s) => (conv ? s.blocked.includes(conv.participantId) : false));
  const showLastSeen = useStore((s) => s.settings.showLastSeen);
  const hasStory = useStore((s) => (conv ? s.stories.some((st) => st.userId === conv.participantId && isStoryLive(st)) : false));
  const typing = useLive((s) => s.typing[id]);
  const store = useStore.getState();

  const [text, setText] = useState(() => conv?.draft || prefill || '');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [selected, setSelected] = useState<Message | null>(null);
  const [attach, setAttach] = useState(false);
  const [menu, setMenu] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [counterFor, setCounterFor] = useState<Message | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const recStart = useRef(0);
  const [recSecs, setRecSecs] = useState(0);
  const input = useRef<TextInput>(null);
  const mountedAt = useRef(Date.now());

  useFocusEffect(
    useCallback(() => {
      useLive.setState({ activeConversationId: id });
      useStore.getState().markRead(id);
      return () => useLive.setState({ activeConversationId: null });
    }, [id]),
  );

  useEffect(() => {
    const h = setTimeout(() => useStore.getState().setDraftText(id, text), 400);
    return () => clearTimeout(h);
  }, [text, id]);

  useEffect(() => {
    if (!recording) return;
    const i = setInterval(() => setRecSecs(Math.floor((Date.now() - recStart.current) / 1000)), 250);
    return () => clearInterval(i);
  }, [recording]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    messages.forEach((m, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      if (!prev || !isSameDay(prev.createdAt, m.createdAt)) out.push({ kind: 'day', id: `d_${m.id}`, label: dayLabel(m.createdAt) });
      const sameAsPrev = !!prev && prev.senderId === m.senderId && isSameDay(prev.createdAt, m.createdAt) && prev.type !== 'system' && m.createdAt - prev.createdAt < 5 * 60_000;
      const sameAsNext = !!next && next.senderId === m.senderId && isSameDay(next.createdAt, m.createdAt) && next.type !== 'system' && next.createdAt - m.createdAt < 5 * 60_000;
      out.push({ kind: 'msg', m, first: !sameAsPrev, last: !sameAsNext });
    });
    return out.reverse();
  }, [messages]);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/chats'));

  if (!conv || !user) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <T dim>Conversation not found</T>
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  const send = (partial: Partial<Message>) => {
    haptic.light();
    store.sendMessage(id, { ...partial, replyToId: replyTo?.id });
    setReplyTo(null);
  };

  const sendText = () => {
    const body = text.trim();
    if (!body) return;
    const firstWithListing = messages.length === 0 && conv.listingId;
    send(firstWithListing ? { type: 'listing', listingId: conv.listingId, body } : { body });
    setText('');
  };

  const pickImage = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast('Permission needed to attach photos', 'alert-circle');
      return;
    }
    const r = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!r.canceled) send({ type: 'image', imageUri: r.assets[0]!.uri });
  };

  const subtitle = typing ? 'typing…' : blocked ? 'blocked' : showLastSeen ? lastSeen(user.online, user.lastSeenAt) : '';

  return (
    <View style={{ flex: 1, backgroundColor: t.chatBg }}>
      {/* header */}
      <View style={{ paddingTop: insets.top, backgroundColor: t.bg, borderBottomWidth: 0.5, borderBottomColor: t.border }}>
        <View style={{ height: 58, flexDirection: 'row', alignItems: 'center', paddingRight: 4 }}>
          <IconButton name="chevron-back" onPress={() => router.back()} />
          <Pressable onPress={() => router.push(`/seller/${user.id}`)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar user={user} size={40} ring={hasStory} onPress={hasStory ? () => router.push(`/story/${user.id}`) : () => router.push(`/seller/${user.id}`)} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text numberOfLines={1} style={{ color: t.text, fontSize: 16.5, fontWeight: '700', flexShrink: 1 }}>{user.displayName}</Text>
                <VerifiedTick user={user} />
              </View>
              {!!subtitle && (
                <Animated.Text key={subtitle} entering={FadeIn} numberOfLines={1} style={{ color: typing || user.online ? t.primary : t.textDim, fontSize: 12.5, fontWeight: typing ? '600' : '400' }}>
                  {subtitle}
                </Animated.Text>
              )}
            </View>
          </Pressable>
          <IconButton name="storefront-outline" onPress={() => router.push(`/seller/${user.id}`)} />
          <IconButton name="ellipsis-vertical" onPress={() => setMenu(true)} />
        </View>

        {/* listing context bar */}
        {conv.listingSnapshot && (
          <Pressable onPress={() => listing && router.push(`/listing/${listing.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: t.border }}>
            <Image source={{ uri: conv.listingSnapshot.image }} style={{ width: 42, height: 42, borderRadius: 8 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <T numberOfLines={1} weight="600" size={13.5}>{conv.listingSnapshot.title}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <T weight="600" size={14} color={t.primary}>{formatNaira(listing?.priceMinor ?? conv.listingSnapshot.priceMinor)}</T>
                {listing && listing.status !== 'active' ? (
                  <T size={11.5} weight="600" color={t.danger}>{listing.status.toUpperCase()}</T>
                ) : (
                  <ConditionBadge condition={conv.listingSnapshot.condition} small />
                )}
              </View>
            </View>
            {listing && listing.sellerId !== meId && listing.status === 'active' && !blocked && (
              <Tap haptics onPress={() => setOfferOpen(true)} style={{ backgroundColor: t.inverse, paddingHorizontal: 12, height: 32, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Icon name="pricetag-outline" size={14} color={t.inverseText} />
                <Text style={{ color: t.inverseText, fontWeight: '600', fontSize: 12.5 }}>Make offer</Text>
              </Tap>
            )}
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <FlatList
          data={rows}
          inverted
          keyExtractor={(r) => (r.kind === 'day' ? r.id : r.m.id)}
          contentContainerStyle={{ paddingVertical: 10 }}
          keyboardDismissMode="interactive"
          initialNumToRender={20}
          maxToRenderPerBatch={15}
          windowSize={11}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={typing ? <TypingBubble /> : null}
          ListFooterComponent={
            <View style={{ alignItems: 'center', paddingHorizontal: 28, paddingVertical: 12, gap: 10 }}>
              <Avatar user={user} size={72} />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <T size={17} weight="600">{user.displayName}</T>
                <VerifiedTick user={user} />
              </View>
              <T dim size={13}>{user.shopType === 'retail' ? 'Shop' : 'Seller'} · {user.city}</T>
              <Text style={{ color: t.textFaint, fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 6 }}>
                Keep the conversation on Neva. Meet in public and inspect before paying. Payments made outside Neva aren’t protected.
              </Text>
            </View>
          }
          renderItem={({ item }) =>
            item.kind === 'day' ? (
              <DayPill label={item.label} />
            ) : (
              <Bubble
                m={item.m}
                mine={item.m.senderId === meId}
                firstInGroup={item.first}
                lastInGroup={item.last}
                isNew={item.m.createdAt > mountedAt.current}
                onLongPress={setSelected}
                onReply={(m) => { setReplyTo(m); input.current?.focus(); }}
                onRetry={(m) => store.retryMessage(id, m.id)}
                onOffer={(m, state) => store.respondToOffer(id, m.id, state)}
                onCounter={(m) => { setCounterFor(m); setOfferOpen(true); }}
                onImage={setViewer}
              />
            )
          }
        />

        {/* composer */}
        {blocked ? (
          <View style={{ padding: 16, paddingBottom: insets.bottom + 12, backgroundColor: t.surface, alignItems: 'center', gap: 8 }}>
            <T dim size={13.5} center>You blocked {user.displayName}. They can’t message you.</T>
            <Button small title="Unblock" variant="ghost" onPress={() => store.toggleBlock(user.id)} />
          </View>
        ) : (
          <View style={{ paddingBottom: Math.max(insets.bottom, 8), paddingTop: 6, borderTopWidth: 0.5, borderTopColor: t.border, backgroundColor: t.bg }}>
            {messages.filter((m) => m.senderId === meId).length < 2 && !replyTo && !text && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingBottom: 8 }}>
                {QUICK_REPLIES.map((q) => (
                  <Chip key={q} label={q} onPress={() => send(messages.length === 0 && conv.listingId ? { type: 'listing', listingId: conv.listingId, body: q } : { body: q })} />
                ))}
              </ScrollView>
            )}
            {replyTo && (
              <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut} style={{ marginHorizontal: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 2, alignSelf: 'stretch', borderRadius: 1, backgroundColor: t.primary }} />
                <View style={{ flex: 1 }}>
                  <T size={12.5} weight="600" color={t.primary}>Replying to {replyTo.senderId === meId ? 'yourself' : user.displayName}</T>
                  <T dim size={13} numberOfLines={1}>{replyTo.type === 'image' ? 'Photo' : replyTo.type === 'offer' ? `Offer ${formatNaira(replyTo.offer!.amountMinor)}` : replyTo.body}</T>
                </View>
                <IconButton name="close" size={18} color={t.textDim} onPress={() => setReplyTo(null)} style={{ padding: 2 }} />
              </Animated.View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, gap: 6 }}>
              {recording ? (
                <IconButton name="trash-outline" color={t.danger} size={24} onPress={() => { setRecording(false); haptic.warn(); }} style={{ marginBottom: 2 }} />
              ) : (
                <IconButton name="add-circle" color={t.primary} size={28} onPress={() => setAttach(true)} style={{ marginBottom: 1 }} />
              )}
              <View style={{ flex: 1, backgroundColor: t.surface2, borderRadius: 22, minHeight: 44, justifyContent: 'center' }}>
                {recording ? (
                  <RecordingBar secs={recSecs} />
                ) : (
                  <TextInput
                    ref={input}
                    value={text}
                    onChangeText={setText}
                    placeholder="Message"
                    placeholderTextColor={t.textDim}
                    multiline
                    style={{ color: t.text, fontSize: 16, paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 12 : 10, paddingBottom: Platform.OS === 'ios' ? 12 : 10, maxHeight: 140 }}
                  />
                )}
              </View>
              <Tap
                onPress={
                  text.trim()
                    ? sendText
                    : recording
                      ? () => { setRecording(false); send({ type: 'voice', voice: { seconds: Math.max(1, recSecs) } }); }
                      : () => { haptic.medium(); recStart.current = Date.now(); setRecSecs(0); setRecording(true); }
                }
                hitSlop={6}
                style={{ width: 46, height: 46, borderRadius: 23, overflow: 'hidden' }}>
                <LinearGradient colors={[...t.brandGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={text.trim() || recording ? 'arrow-up' : 'mic'} size={text.trim() || recording ? 22 : 24} color="#fff" />
                </LinearGradient>
              </Tap>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* message actions with reaction bar */}
      <Sheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        header={
          selected && !selected.deleted ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 12, paddingBottom: 10 }}>
              {EMOJIS.map((e, i) => (
                <Animated.View key={e} entering={FadeIn.duration(200)}>
                  <Pressable
                    onPress={() => { haptic.select(); store.react(id, selected.id, e); setSelected(null); }}
                    style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: selected.reactions?.[meId] === e ? t.primary + '33' : t.surface2 }}>
                    <Text style={{ fontSize: 24 }}>{e}</Text>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          ) : null
        }
        actions={
          selected
            ? [
                { label: 'Reply', icon: 'arrow-undo-outline', onPress: () => { setReplyTo(selected); input.current?.focus(); } },
                ...(selected.body ? [{ label: 'Copy', icon: 'copy-outline' as const, onPress: () => { Clipboard.setStringAsync(selected.body!); showToast('Copied'); } }] : []),
                { label: selected.starred ? 'Unstar' : 'Star', icon: selected.starred ? 'star' : 'star-outline', onPress: () => store.toggleStar(id, selected.id) },
                ...(selected.senderId === meId && !selected.deleted ? [{ label: 'Delete for everyone', icon: 'trash-outline' as const, danger: true, onPress: () => store.deleteMessage(id, selected.id) }] : []),
                ...(selected.senderId !== meId ? [{ label: 'Report message', icon: 'flag-outline' as const, danger: true, onPress: () => router.push({ pathname: '/report', params: { type: 'message', target: selected.id, name: user.displayName } }) }] : []),
              ]
            : []
        }
      />

      {/* attachment sheet */}
      <Sheet visible={attach} onClose={() => setAttach(false)}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingVertical: 8, rowGap: 18 }}>
          {[
            { icon: 'images-outline', label: 'Gallery', onPress: () => pickImage(false) },
            { icon: 'camera-outline', label: 'Camera', onPress: () => pickImage(true) },
            ...(listing && listing.sellerId !== meId ? [{ icon: 'pricetag-outline', label: 'Offer', onPress: () => setOfferOpen(true) }] : []),
            { icon: 'location-outline', label: 'Meet spot', onPress: () => send({ body: 'Let’s meet at a public place — can you suggest a mall or bank near you?' }) },
            { icon: 'shield-checkmark-outline', label: 'Safety', onPress: () => router.push('/settings/safety') },
            { icon: 'storefront-outline', label: 'Their shop', onPress: () => router.push(`/seller/${user.id}`) },
          ].map((a) => (
            <Pressable key={a.label} onPress={() => { setAttach(false); setTimeout(a.onPress, 250); }} style={{ width: '25%', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={a.icon as any} size={24} color={t.text} />
              </View>
              <T size={12.5} dim>{a.label}</T>
            </Pressable>
          ))}
        </View>
      </Sheet>

      <OfferSheet
        visible={offerOpen}
        listingPrice={listing?.priceMinor ?? 0}
        counterOf={counterFor?.offer?.amountMinor}
        onClose={() => { setOfferOpen(false); setCounterFor(null); }}
        onSubmit={(amount) => {
          if (counterFor) store.respondToOffer(id, counterFor.id, 'countered');
          send({ type: 'offer', offer: { amountMinor: amount, state: 'pending' } });
          setOfferOpen(false);
          setCounterFor(null);
        }}
      />

      <Sheet
        visible={menu}
        onClose={() => setMenu(false)}
        actions={[
          { label: 'View shop', icon: 'storefront-outline', onPress: () => router.push(`/seller/${user.id}`) },
          ...(listing ? [{ label: 'View listing', icon: 'pricetag-outline' as const, onPress: () => router.push(`/listing/${listing.id}`) }] : []),
          { label: conv.muted ? 'Unmute notifications' : 'Mute notifications', icon: conv.muted ? 'volume-high-outline' : 'volume-mute-outline', onPress: () => store.toggleMute(id) },
          { label: conv.pinned ? 'Unpin chat' : 'Pin chat', icon: 'pin-outline', onPress: () => store.togglePin(id) },
          { label: 'Archive chat', icon: 'archive-outline', onPress: () => { store.setArchived(id, true); leave(); showToast('Chat archived', 'archive-outline'); } },
          {
            label: 'Clear chat',
            icon: 'remove-circle-outline',
            onPress: () => Alert.alert('Clear this chat?', 'All messages in this chat are removed from this device.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: () => store.clearChat(id) }]),
          },
          ...(messages.some((m) => m.senderId === meId) ? [{ label: 'Rate this seller', icon: 'star-outline' as const, onPress: () => router.push({ pathname: '/review', params: { sellerId: user.id, listingId: conv.listingId ?? '' } }) }] : []),
          { label: blocked ? 'Unblock' : 'Block', icon: 'ban-outline', danger: true, onPress: () => { store.toggleBlock(user.id); showToast(blocked ? 'Unblocked' : `${user.displayName} blocked`, 'ban'); } },
          { label: 'Report', icon: 'flag-outline', danger: true, onPress: () => router.push({ pathname: '/report', params: { type: 'user', target: user.id, name: user.displayName } }) },
          {
            label: 'Delete chat',
            icon: 'trash-outline',
            danger: true,
            onPress: () =>
              Alert.alert('Delete this chat?', 'Messages are removed from this device. This can’t be undone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => { leave(); useStore.getState().deleteConversation(id); showToast('Chat deleted', 'trash-outline'); } },
              ]),
          },
        ]}
      />

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)} statusBarTranslucent>
        <Pressable onPress={() => setViewer(null)} style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
          {viewer && <Image source={{ uri: viewer }} style={{ width: '100%', height: '80%' }} contentFit="contain" />}
          <View style={{ position: 'absolute', top: insets.top + 8, right: 12 }}>
            <Icon name="close" size={30} color="#fff" />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function RecordingBar({ secs }: { secs: number }) {
  const t = useTheme();
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withTiming(0.25, { duration: 600 }), -1, true);
  }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: 16, gap: 10 }}>
      <Animated.View style={[{ width: 9, height: 9, borderRadius: 5, backgroundColor: t.danger }, a]} />
      <T weight="500" style={{ fontVariant: ['tabular-nums'] }}>0:{String(secs).padStart(2, '0')}</T>
    </View>
  );
}

function OfferSheet({ visible, onClose, onSubmit, listingPrice, counterOf }: { visible: boolean; onClose: () => void; onSubmit: (amountMinor: number) => void; listingPrice: number; counterOf?: number }) {
  const t = useTheme();
  const [val, setVal] = useState('');
  useEffect(() => {
    if (visible) setVal(String(Math.round((counterOf ?? listingPrice * 0.9) / 100)));
  }, [visible, listingPrice, counterOf]);
  const amount = Number(val.replace(/\D/g, '')) * 100;
  const pct = listingPrice ? Math.round((1 - amount / listingPrice) * 100) : 0;
  return (
    <Sheet visible={visible} onClose={onClose} title={counterOf ? 'Counter offer' : 'Make an offer'}>
      <View style={{ paddingHorizontal: 20, gap: 14, paddingBottom: 10 }}>
        <T dim size={13.5}>Listed at {formatNaira(listingPrice)}{counterOf ? ` · they offered ${formatNaira(counterOf)}` : ''}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface2, borderRadius: radius.lg, paddingHorizontal: 18 }}>
          <Text style={{ color: t.text, fontSize: 34, fontWeight: '700' }}>₦</Text>
          <TextInput value={Number(val || 0).toLocaleString('en-NG')} onChangeText={(v) => setVal(v.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" style={{ flex: 1, color: t.text, fontSize: 34, fontWeight: '700', height: 72, marginLeft: 4 }} />
        </View>
        {listingPrice > 0 && (
          <>
            <T size={13} color={pct > 25 ? t.danger : pct > 10 ? t.warning : t.primary} weight="600">
              {pct > 0 ? `${pct}% below asking` : pct < 0 ? `${-pct}% above asking` : 'Asking price'}
              {pct > 25 ? ' · very low offers are often ignored' : ''}
            </T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[0.95, 0.9, 0.85].map((f) => (
                <Chip key={f} label={formatNaira(Math.round((listingPrice * f) / 100_000) * 100_000)} onPress={() => setVal(String(Math.round((listingPrice * f) / 100_000) * 1000))} />
              ))}
            </View>
          </>
        )}
        <Button title={`Send offer · ${formatNaira(amount)}`} disabled={amount <= 0} onPress={() => onSubmit(amount)} icon="send" />
        <T faint size={11.5} center>Offers aren’t binding payments. Agree details in chat and inspect before paying.</T>
      </View>
    </Sheet>
  );
}
