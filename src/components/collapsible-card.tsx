import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type CollapsibleCardProps = {
  title: string;
  children: ReactNode;
};

/** A card whose body is collapsed by default and expands on tap — for
 * sections people set up once and rarely revisit (Password, Appearance),
 * so they don't permanently take up scroll space next to the ones people
 * actually use every visit. */
export function CollapsibleCard({ title, children }: CollapsibleCardProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withTiming(expanded ? 90 : 0, { duration: 180 });
  }, [expanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <Pressable onPress={() => setExpanded((v) => !v)} style={styles.headerRow}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {title}
        </ThemedText>
        <Animated.View style={chevronStyle}>
          <ThemedText themeColor="textSecondary" style={styles.chevron}>
            ›
          </ThemedText>
        </Animated.View>
      </Pressable>
      {expanded && (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={[styles.body, { borderTopColor: theme.background }]}>
          {children}
        </Animated.View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.four, padding: Spacing.three },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chevron: { fontSize: 18, lineHeight: 18 },
  body: { gap: Spacing.three, marginTop: Spacing.three, paddingTop: Spacing.three, borderTopWidth: 1 },
});
