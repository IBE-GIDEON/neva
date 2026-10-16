import { FlatList, View } from 'react-native';

import { Avatar, Button, EmptyState, Header, T } from '@/components/ui';
import { useStore } from '@/store';
import { useTheme } from '@/theme';

export default function Blocked() {
  const t = useTheme();
  const blocked = useStore((s) => s.blocked);
  const users = useStore((s) => s.users);
  const toggleBlock = useStore((s) => s.toggleBlock);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="Blocked accounts" />
      <FlatList
        data={blocked}
        keyExtractor={(id) => id}
        renderItem={({ item: id }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
            <Avatar user={users[id]} size={46} />
            <T weight="600" style={{ flex: 1 }}>{users[id]?.displayName ?? 'Unknown'}</T>
            <Button small title="Unblock" variant="secondary" onPress={() => toggleBlock(id)} />
          </View>
        )}
        ListEmptyComponent={<EmptyState icon="ban-outline" title="No blocked accounts" body="Blocked accounts can’t message you, and their listings are hidden from your feed." />}
      />
    </View>
  );
}
