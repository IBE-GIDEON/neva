import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, haptic, Header, Icon, T } from '@/components/ui';
import { REPORT_REASONS } from '@neva/core';
import type { Report } from '@neva/core';
import { useStore } from '@/store';
import { radius, useTheme } from '@/theme';

export default function ReportScreen() {
  const { type, target, name } = useLocalSearchParams<{ type: Report['targetType']; target: string; name?: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const submitReport = useStore((s) => s.submitReport);
  const toggleBlock = useStore((s) => s.toggleBlock);
  const blocked = useStore((s) => s.blocked);
  const listing = useStore((s) => (type === 'listing' ? s.listings[target] : undefined));
  const [reason, setReason] = useState<string>();
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(type === 'user');
  const [caseId, setCaseId] = useState<string>();

  const blockTarget = type === 'user' ? target : listing?.sellerId;

  const submit = () => {
    if (!reason) return;
    const id = submitReport({ targetType: type, targetId: target, reason, details: details.trim() || undefined });
    if (alsoBlock && blockTarget && !blocked.includes(blockTarget)) toggleBlock(blockTarget);
    haptic.success();
    setCaseId(id);
  };

  if (caseId) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 14 }}>
        <Animated.View entering={FadeIn} style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: t.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="checkmark-circle" size={60} color={t.primary} />
        </Animated.View>
        <T size={22} weight="600" center>Thanks for reporting</T>
        <T dim center style={{ lineHeight: 21 }}>Our moderation team will review it. Your identity isn’t shared with the person you reported.</T>
        <View style={{ backgroundColor: t.surface2, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 10 }}>
          <T weight="600" size={16}>Case ID: {caseId}</T>
        </View>
        {alsoBlock && blockTarget && <T dim size={13}>We’ve also blocked this account for you.</T>}
        <Button title="Done" style={{ alignSelf: 'stretch', marginTop: 10 }} onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={`Report ${type}`} subtitle={name} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 40 }}>
        <T dim style={{ marginBottom: 6 }}>Why are you reporting this? If someone is in immediate danger, contact local emergency services first.</T>
        {REPORT_REASONS.map((r) => {
          const on = reason === r;
          return (
            <Pressable key={r} onPress={() => { haptic.select(); setReason(r); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: on ? t.danger + '14' : t.surface, borderWidth: 1, borderColor: on ? t.danger : t.border }}>
              <Icon name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? t.danger : t.textFaint} />
              <T weight={on ? '700' : '500'}>{r}</T>
            </Pressable>
          );
        })}
        <TextInput value={details} onChangeText={setDetails} placeholder="Add details (optional) — what happened?" placeholderTextColor={t.textFaint} multiline maxLength={1000} style={{ marginTop: 10, minHeight: 110, backgroundColor: t.surface2, borderRadius: radius.md, padding: 14, color: t.text, fontSize: 15.5, textAlignVertical: 'top' }} />
        {blockTarget && (
          <Pressable onPress={() => setAlsoBlock(!alsoBlock)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
            <Icon name={alsoBlock ? 'checkbox' : 'square-outline'} size={22} color={alsoBlock ? t.primary : t.textDim} />
            <T>Also block this account</T>
          </Pressable>
        )}
      </ScrollView>
      <View style={{ padding: 16, paddingBottom: insets.bottom + 12 }}>
        <Button title="Submit report" variant="danger" disabled={!reason} onPress={submit} />
      </View>
    </KeyboardAvoidingView>
  );
}
