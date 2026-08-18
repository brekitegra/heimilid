import { Pressable, StyleSheet, View } from 'react-native';

import type { SectionIconProps } from '@/components/icons/section-icons';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ComingSoonSectionProps = {
  title: string;
  description: string;
  Icon: (props: SectionIconProps) => React.JSX.Element;
  onBack: () => void;
};

/** Placeholder body for a hub section that hasn't been built out yet —
 * a back link, an icon badge, and a short description. Each section
 * (chores/pets/finances/kids) renders this today; swap it out for real
 * content in that section's own file as each gets built. */
export function ComingSoonSection({ title, description, Icon, onBack }: ComingSoonSectionProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} hitSlop={8} style={styles.backRow}>
        <ThemedText type="linkPrimary">‹ Home</ThemedText>
      </Pressable>

      <View style={styles.body}>
        <View style={[styles.iconBadge, { backgroundColor: theme.backgroundElement }]}>
          <Icon color={theme.accent} size={32} />
        </View>
        <ThemedText type="subtitle" style={styles.title}>
          {title}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.description}>
          {description}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.comingSoon}>
          Coming soon
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch', flex: 1 },
  backRow: { alignSelf: 'flex-start' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingBottom: Spacing.six },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  title: { textAlign: 'center' },
  description: { textAlign: 'center' },
  comingSoon: { marginTop: Spacing.two },
});
