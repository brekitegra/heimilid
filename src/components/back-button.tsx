import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The "‹ Home"/"‹ Health"/etc. back link every section and mini-hub
 * screen shows at its top. Used to just be plain accent-colored text —
 * easy to miss against the plain background — so this gives it a filled
 * pill chip instead, matching the pill-button treatment already used for
 * mode toggles/filters elsewhere in the app, for a much more obvious tap
 * target. */
export function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable onPress={onPress} hitSlop={8} style={[styles.button, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="smallBold" themeColor="accent">
        ‹ {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    // The top bar's own pill has more inset padding (32px) than this
    // pill's own paddingHorizontal (16px) — shift left by the difference
    // so the two pills' rounded left edges line up flush, not just their
    // text.
    marginLeft: -Spacing.four,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
});
