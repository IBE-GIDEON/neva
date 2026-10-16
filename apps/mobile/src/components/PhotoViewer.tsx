import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './ui';

/** Full-screen, images-only viewer. Swipe between photos; tap a photo or ✕ to go back. */
export function PhotoViewer({ images, index, onClose }: { images: string[]; index: number | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = Dimensions.get('window');
  const [page, setPage] = useState(index ?? 0);
  const scroller = useRef<ScrollView>(null);

  useEffect(() => {
    if (index == null) return;
    setPage(index);
    requestAnimationFrame(() => scroller.current?.scrollTo({ x: index * W, animated: false }));
  }, [index, W]);

  return (
    <Modal visible={index != null} transparent={false} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: (index ?? 0) * W, y: 0 }}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / W))}>
          {images.map((uri) => (
            <Pressable key={uri} onPress={onClose} style={{ width: W, height: H, justifyContent: 'center' }}>
              <Image source={{ uri }} style={{ width: W, height: H * 0.8 }} contentFit="contain" transition={150} />
            </Pressable>
          ))}
        </ScrollView>
        <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onClose} hitSlop={12} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={22} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }} />
          {images.length > 1 && <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500' }}>{page + 1} / {images.length}</Text>}
        </View>
        {images.length > 1 && (
          <View pointerEvents="none" style={{ position: 'absolute', bottom: insets.bottom + 24, alignSelf: 'center', flexDirection: 'row', gap: 6 }}>
            {images.map((_, i) => (
              <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === page ? '#fff' : 'rgba(255,255,255,0.35)' }} />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}
