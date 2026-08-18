import { Image, type ImageStyle } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function initialsFor(name: string | null | undefined) {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export type AvatarProps = {
  url?: string | null;
  name?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** A person's avatar: their uploaded photo if they have one, otherwise a
 * colored circle with their initials — same fallback used app-wide before
 * real avatars existed. */
export function Avatar({ url, name, size = 40, style }: AvatarProps) {
  const theme = useTheme();
  const circleStyle = { width: size, height: size, borderRadius: size / 2 };

  if (url) {
    // `style` is typed for the View fallback below; width/height/borderRadius
    // (all it's ever used for) are valid on both View and Image styles.
    return <Image source={{ uri: url }} style={[circleStyle, style as StyleProp<ImageStyle>]} contentFit="cover" />;
  }

  return (
    <View style={[circleStyle, styles.fallback, { backgroundColor: theme.backgroundSelected }, style]}>
      <ThemedText type="small" themeColor="text" style={{ fontSize: size * 0.4 }}>
        {initialsFor(name)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
