import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, EmptyState, haptic, Header, Icon, T, VerifiedTick } from '@/components/ui';
import { formatNaira } from '@neva/core';
import { showToast, useStore } from '@/store';
import { radius, useTheme } from '@/theme';

const LABELS = ['', 'Poor', 'Below expectations', 'Okay', 'Good', 'Excellent'];

export default function ReviewScreen() {
  const { sellerId, listingId } = useLocalSearchParams<{ sellerId: string; listingId?: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const seller = useStore((s) => s.users[sellerId]);
  const meId = useStore((s) => s.meId);
  const eligible = useStore((s) => s.canReview(sellerId));
  const existing = useStore((s) => s.reviews.find((r) => r.sellerId === sellerId && r.reviewerId === s.meId));
  const conversations = useStore((s) => s.conversations);
  const listings = useStore((s) => s.listings);
  const saveReview = useStore((s) => s.saveReview);
  const deleteReview = useStore((s) => s.deleteReview);

  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [text, setText] = useState(existing?.text ?? '');
  const [item, setItem] = useState<string | undefined>(existing?.listingId ?? (listingId || undefined));

  // Items you actually discussed with this seller
  const discussed = useMemo(
    () =>
      Array.from(new Set(Object.values(conversations).filter((c) => c.participantId === sellerId && c.listingId).map((c) => c.listingId!)))
        .map((id) => listings[id])
        .filter((l) => !!l),
    [conversations, listings, sellerId],
  );

  if (!seller || sellerId === meId) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  if (!eligible) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <Header title="Rate seller" />
        <EmptyState icon="chatbubbles-outline" title="Chat first" body={`You can rate ${seller.displayName} after you’ve messaged them about an item. This keeps reviews tied to real interactions.`} />
      </View>
    );
  }

  const submit = () => {
    if (!rating) return;
    saveReview({ sellerId, listingId: item, rating, text });
    haptic.success();
    showToast(existing ? 'Review updated' : 'Thanks for your review', 'star-outline');
    router.back();
  };

  const remove = () =>
    Alert.alert('Delete your review?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteReview(sellerId); router.back(); } },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={existing ? 'Edit review' : 'Rate seller'} right={existing ? <Pressable onPress={remove} hitSlop={8} style={{ paddingHorizontal: 12 }}><T color={t.danger} size={15}>Delete</T></Pressable> : undefined} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 22 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Avatar user={seller} size={64} />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <T size={17} weight="600">{seller.displayName}</T>
            <VerifiedTick user={seller} />
          </View>
          <T dim size={13.5}>How was your experience?</T>
        </View>

        <View style={{ alignItems: 'center', gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Pressable key={i} onPress={() => { haptic.select(); setRating(i); }} hitSlop={6}>
                <Icon name={rating >= i ? 'star' : 'star-outline'} size={40} color={rating >= i ? t.primary : t.textFaint} />
              </Pressable>
            ))}
          </View>
          <T size={14} weight="500" color={rating ? t.text : t.textFaint}>{rating ? LABELS[rating] : 'Tap to rate'}</T>
        </View>

        {discussed.length > 0 && (
          <View style={{ gap: 10 }}>
            <T dim size={13} weight="500">Which item was it about? (optional)</T>
            {discussed.map((l) => {
              const on = item === l.id;
              return (
                <Pressable key={l.id} onPress={() => setItem(on ? undefined : l.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.md, borderWidth: 1.5, borderColor: on ? t.primary : t.border }}>
                  <Image source={{ uri: l.images[0] }} style={{ width: 44, height: 44, borderRadius: 8 }} />
                  <View style={{ flex: 1 }}>
                    <T size={14} numberOfLines={1}>{l.title}</T>
                    <T dim size={12.5}>{formatNaira(l.priceMinor)}</T>
                  </View>
                  <Icon name={on ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={on ? t.primary : t.textFaint} />
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ gap: 8 }}>
          <T dim size={13} weight="500">Tell others more (optional)</T>
          <TextInput
            value={text}
            onChangeText={(v) => setText(v.slice(0, 500))}
            placeholder="Was the item as described? How was communication and pickup?"
            placeholderTextColor={t.textFaint}
            multiline
            style={{ minHeight: 120, borderRadius: radius.md, backgroundColor: t.surface2, padding: 14, color: t.text, fontSize: 15.5, textAlignVertical: 'top' }}
          />
          <T faint size={12} style={{ alignSelf: 'flex-end' }}>{text.length}/500</T>
        </View>

        <T faint size={12} style={{ lineHeight: 17 }}>
          Your review is shown with your name and marked “Chatted on Neva”. Keep it honest and about the transaction — no personal details, threats or insults. Sellers can’t pay to change ratings.
        </T>
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom + 14, borderTopWidth: 0.5, borderTopColor: t.border }}>
        <Button title={existing ? 'Update review' : 'Submit review'} variant="gradient" disabled={!rating} onPress={submit} />
      </View>
    </KeyboardAvoidingView>
  );
}
