import { FlatList, View } from 'react-native';

import { EmptyState, Header, T } from '@/components/ui';
import { timeAgo } from '@neva/core';
import { useStore } from '@/store';
import { radius, useTheme } from '@/theme';

export default function MyReports() {
  const t = useTheme();
  const reports = useStore((s) => s.reports);
  const color = { open: t.textDim, in_review: t.primary, actioned: t.success, closed: t.textFaint };
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="My reports" subtitle="Track what happened to things you reported" />
      <FlatList
        data={reports}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item: r }) => (
          <View style={{ backgroundColor: t.surface, borderRadius: radius.lg, padding: 14, gap: 6, borderWidth: 0.5, borderColor: t.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T weight="600" style={{ flex: 1 }}>{r.caseId}</T>
              <View style={{ backgroundColor: color[r.status] + '22', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 }}>
                <T size={12} weight="600" color={color[r.status]}>{r.status.replace('_', ' ').toUpperCase()}</T>
              </View>
            </View>
            <T>{r.reason}</T>
            <T dim size={12.5}>Reported {r.targetType} · {timeAgo(r.createdAt)}</T>
          </View>
        )}
        ListEmptyComponent={<EmptyState icon="flag-outline" title="No reports" body="When you report something, you’ll get a case ID and can follow its status here." />}
      />
    </View>
  );
}
