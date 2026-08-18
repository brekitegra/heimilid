import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SectionIconProps } from '@/components/icons/section-icons';

export type HubCardProps = {
  title: string;
  hint: string;
  Icon: (props: SectionIconProps) => React.JSX.Element;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** One tappable tile on the home hub — an icon badge, title, hint, and a
 * chevron affordance, all inside a single pressable card. */
export function HubCard({ title, hint, Icon, onPress, style }: HubCardProps) {
  const theme = useTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed, style]}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={[styles.iconBadge, { backgroundColor: theme.backgroundSelected }]}>
          <Icon color={theme.accent} size={22} />
        </View>
        <View style={styles.textContainer}>
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        </View>
        <ThemedText themeColor="textSecondary" style={styles.chevron}>
          ›
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.four,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: { flex: 1, gap: Spacing.half },
  chevron: { fontSize: 22, lineHeight: 22 },
});
