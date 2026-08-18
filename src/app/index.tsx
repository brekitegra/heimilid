import { Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useHousehold } from '@/hooks/use-household';

const UPCOMING_SECTIONS = [
  { title: 'Chores', hint: 'Assign and track household chores' },
  { title: 'Pets', hint: 'Feeding, vet visits, and care' },
  { title: 'Finances', hint: 'Accounts and recurring bills' },
  { title: 'Kids', hint: "Practices and activity schedules" },
];

export default function HomeScreen() {
  const { household } = useHousehold();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <ThemedText type="small" themeColor="textSecondary">
            Welcome home
          </ThemedText>
          <ThemedText type="title" style={styles.title}>
            {household?.name ?? 'Heimilið'}
          </ThemedText>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.stepContainer}>
          {UPCOMING_SECTIONS.map((section, index) => (
            <ThemedView
              key={section.title}
              style={[styles.row, index > 0 && styles.rowDivider]}>
              <ThemedText type="smallBold">{section.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {section.hint}
              </ThemedText>
            </ThemedView>
          ))}
        </ThemedView>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Coming soon
        </ThemedText>

        {Platform.OS === 'web' && <WebBadge />}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
    // The web tab bar (app-tabs.web.tsx) is position: absolute over the
    // page, so content needs its own top offset to clear it.
    ...Platform.select({ web: { paddingTop: Spacing.six } }),
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    textAlign: 'center',
  },
  stepContainer: {
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
  row: {
    gap: Spacing.half,
    paddingVertical: Spacing.three,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  centerText: {
    textAlign: 'center',
  },
});
