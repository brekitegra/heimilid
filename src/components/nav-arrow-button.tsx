import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** A small circular prev/next control for date/week navigation (Health
 * Today's day switcher, Groceries' dinner-plan week switcher). Used to
 * just be a bare "‹"/"›" glyph floating with no visible tap target —
 * this gives it the same filled-pill treatment as BackButton, just
 * circular since it's a single glyph rather than a label. */
export function NavArrowButton({ direction, onPress }: { direction: 'prev' | 'next'; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable onPress={onPress} hitSlop={8} style={[styles.button, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="smallBold" themeColor="accent" style={styles.glyph}>
        {direction === 'prev' ? '‹' : '›'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontSize: 18,
    lineHeight: 20,
  },
});
