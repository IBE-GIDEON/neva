import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Icon, IconButton, Section, T, Tap, VerifiedTick } from '@/components/ui';
import type { Story } from '@neva/core';
import { formatNaira, timeAgo } from '@neva/core';
import { isStoryLive, showToast, useStore } from '@/store';
import { radius, useTheme } from '@/theme';

export default function Updates() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const stories = useStore((s) => s.stories);
  const viewed = useStore((s) => s.viewedStories);
  const users = useStore((s) => s.users);
  const meId = useStore((s) => s.meId);
  const follows = useStore((s) => s.follows);
  const listings = useStore((s) => s.listings);
  const toggleFollow = useStore((s) => s.toggleFollow);
  const me = users[meId];

  const groups = useMemo(() => {
    const live = stories.filter((s) => isStoryLive(s) && s.userId !== meId);
    const by: Record<string, Story[]> = {};
    live.forEach((s) => (by[s.userId] ??= []).push(s));
    return Object.entries(by)
      .map(([userId, list]) => ({ userId, list: list.sort((a, b) => a.createdAt - b.createdAt), unseen: list.some((s) => !viewed.includes(s.id)), latest: Math.max(...list.map((s) => s.createdAt)) }))
      .sort((a, b) => Number(b.unseen) - Number(a.unseen) || b.latest - a.latest);
  }, [stories, viewed, meId]);

  const recent = groups.filter((g) => g.unseen);
  const seen = groups.filter((g) => !g.unseen);

  const mine = stories.filter((s) => s.userId === meId && isStoryLive(s));
  const drops = Object.values(listings)
    .filter((l) => follows.includes(l.sellerId) && l.status === 'active')
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
    .slice(0, 8);
  const suggestions = Object.values(users).filter((u) => u.id !== meId && u.isSeller && !follows.includes(u.id));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', height: 56 + insets.top }}>
        <Text style={{ color: t.text, fontSize: 26, fontWeight: '700', flex: 1, letterSpacing: -0.7 }}>Updates</Text>
        <IconButton name="search" onPress={() => router.push('/search')} />
        <IconButton name="lock-closed-outline" onPress={() => router.push('/settings/privacy')} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Section title="Status">
          {recent.length > 0 && (
            <T dim size={12.5} weight="600" style={{ paddingHorizontal: 16, marginBottom: 8, letterSpacing: 0.3 }}>RECENT</T>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}>
            <StoryCard
              cover={mine[mine.length - 1]}
              label="My status"
              sub={mine.length ? timeAgo(mine[mine.length - 1]!.createdAt) : 'Tap to add'}
              user={me}
              add={!mine.length}
              onPress={() => (mine.length ? router.push(`/story/${meId}`) : router.push('/status-new'))}
            />
            {recent.map((g) => (
              <Animated.View key={g.userId} entering={FadeIn.duration(200)}>
                <StoryCard cover={g.list[g.list.length - 1]} label={users[g.userId]?.displayName ?? ''} sub={timeAgo(g.latest)} user={users[g.userId]} unseen onPress={() => router.push(`/story/${g.userId}`)} />
              </Animated.View>
            ))}
          </ScrollView>
          {seen.length > 0 && (
            <>
              <T dim size={12.5} weight="600" style={{ paddingHorizontal: 16, marginTop: 14, marginBottom: 8, letterSpacing: 0.3 }}>VIEWED</T>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}>
                {seen.map((g) => (
                  <StoryCard key={g.userId} cover={g.list[g.list.length - 1]} label={users[g.userId]?.displayName ?? ''} sub={timeAgo(g.latest)} user={users[g.userId]} onPress={() => router.push(`/story/${g.userId}`)} />
                ))}
              </ScrollView>
            </>
          )}
        </Section>

        <Section title="New drops from sellers you follow" action={drops.length ? 'See all' : undefined} onAction={() => router.navigate({ pathname: '/(tabs)/explore', params: { tab: 'following', t: String(Date.now()) } })}>
          {drops.length === 0 ? (
            <T dim style={{ paddingHorizontal: 16 }}>Follow sellers to see their newest listings here.</T>
          ) : (
            drops.map((l) => (
              <Pressable key={l.id} onPress={() => router.push(`/listing/${l.id}`)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: pressed ? t.surface2 : 'transparent' })}>
                <View>
                  <Image source={{ uri: l.images[0] }} style={{ width: 58, height: 58, borderRadius: 14 }} />
                  <View style={{ position: 'absolute', bottom: -4, right: -4 }}>
                    <Avatar user={users[l.sellerId]} size={24} />
                  </View>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <T weight="600" size={14}>{users[l.sellerId]?.displayName}</T>
                    <VerifiedTick user={users[l.sellerId]} size={13} />
                    <T faint size={12}> · {timeAgo(l.publishedAt ?? l.createdAt)}</T>
                  </View>
                  <T numberOfLines={1} size={14}>{l.title}</T>
                  <T weight="600" color={t.primary} size={14}>{formatNaira(l.priceMinor)}</T>
                </View>
                <Icon name="chevron-forward" size={18} color={t.textFaint} />
              </Pressable>
            ))
          )}
        </Section>

        {suggestions.length > 0 && (
          <Section title="Find sellers to follow">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}>
              {suggestions.map((u) => (
                <Pressable key={u.id} onPress={() => router.push(`/seller/${u.id}`)} style={{ width: 150, backgroundColor: t.surface, borderRadius: radius.lg, padding: 14, alignItems: 'center', gap: 6, borderWidth: 0.5, borderColor: t.border }}>
                  <Avatar user={u} size={64} />
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <T weight="600" size={13.5} numberOfLines={1}>{u.displayName}</T>
                    <VerifiedTick user={u} size={13} />
                  </View>
                  <T dim size={12} numberOfLines={1}>{u.city}</T>
                  <Tap haptics onPress={() => { toggleFollow(u.id); showToast(`Following ${u.displayName}`, 'person-add'); }} style={{ backgroundColor: t.primary, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 7, marginTop: 4 }}>
                    <T weight="600" size={13} color={t.primaryText}>Follow</T>
                  </Tap>
                </Pressable>
              ))}
            </ScrollView>
          </Section>
        )}
      </ScrollView>

      <View style={{ position: 'absolute', right: 18, bottom: 22, gap: 12, alignItems: 'center' }}>
        <Tap haptics onPress={() => router.push({ pathname: '/status-new', params: { mode: 'text' } })} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.surface3, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="pencil" size={20} />
        </Tap>
        <Tap haptics onPress={() => router.push('/status-new')} style={{ borderRadius: 18, overflow: 'hidden', elevation: 6 }}>
          <LinearGradient colors={[t.primary, t.indigo]} style={{ width: 58, height: 58, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="camera" size={25} color={t.primaryText} />
          </LinearGradient>
        </Tap>
      </View>
    </View>
  );
}

function StoryCard({ cover, label, sub, user, unseen, add, onPress }: { cover?: Story; label: string; sub: string; user?: any; unseen?: boolean; add?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Tap onPress={onPress} scaleTo={0.95} style={{ width: 112, height: 176, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: cover?.videoUri ? '#111113' : cover?.bg ?? t.surface2 }}>
      {cover?.videoUri ? (
        // Video status: static tile (no players in lists)
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' } as any}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="play" size={20} color="#fff" style={{ marginLeft: 2 }} />
          </View>
          {!!cover.videoSeconds && <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', marginTop: 6 }}>0:{String(Math.round(cover.videoSeconds)).padStart(2, '0')}</Text>}
        </View>
      ) : cover?.imageUri ? (
        <Image source={{ uri: cover.imageUri }} style={{ position: 'absolute', inset: 0 } as any} contentFit="cover" />
      ) : cover?.text ? (
        <View style={{ flex: 1, padding: 10, justifyContent: 'center' }}>
          <Text numberOfLines={5} style={{ color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>{cover.text}</Text>
        </View>
      ) : user?.avatarUri ? (
        <Image source={{ uri: user.avatarUri }} style={{ position: 'absolute', inset: 0 } as any} contentFit="cover" />
      ) : null}
      <LinearGradient colors={['rgba(0,0,0,0.25)', 'transparent', 'rgba(0,0,0,0.75)']} style={{ position: 'absolute', inset: 0 } as any} />
      <View style={{ position: 'absolute', top: 8, left: 8 }}>
        <Avatar user={user} size={36} ring={!add} ringSeen={!unseen} />
        {add && (
          <View style={{ position: 'absolute', right: -3, bottom: -3, width: 20, height: 20, borderRadius: 10, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: t.surface2 }}>
            <Icon name="add" size={13} color={t.primaryText} />
          </View>
        )}
      </View>
      <View style={{ position: 'absolute', left: 8, right: 8, bottom: 8 }}>
        <Text numberOfLines={1} style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{label}</Text>
        <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>{sub}</Text>
      </View>
    </Tap>
  );
}
