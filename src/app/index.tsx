import { useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChoresIcon, FinancesIcon, GroceriesIcon, HealthIcon, KidsIcon, PetsIcon } from '@/components/icons/section-icons';
import { HubCard } from '@/components/hub-card';
import { ChoresSection } from '@/components/sections/chores-section';
import { FinancesSection } from '@/components/sections/finances-section';
import { GroceriesSection } from '@/components/sections/groceries-section';
import { HealthSection } from '@/components/sections/health-section';
import { KidsSection } from '@/components/sections/kids-section';
import { PetsSection } from '@/components/sections/pets-section';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useHousehold } from '@/hooks/use-household';

type Section = 'chores' | 'groceries' | 'pets' | 'finances' | 'kids' | 'health';

const SECTIONS: { key: Section; title: string; hint: string; Icon: typeof ChoresIcon }[] = [
  { key: 'chores', title: 'Chores', hint: 'Assign and track household chores', Icon: ChoresIcon },
  { key: 'groceries', title: 'Groceries', hint: 'Shopping lists, recipes, and dinner plans', Icon: GroceriesIcon },
  { key: 'pets', title: 'Pets', hint: 'Feeding, vet visits, and care', Icon: PetsIcon },
  { key: 'finances', title: 'Finances', hint: 'Accounts and recurring bills', Icon: FinancesIcon },
  { key: 'kids', title: 'Kids', hint: 'School, practices, and star rewards', Icon: KidsIcon },
  { key: 'health', title: 'Health', hint: 'Training, macros, and TDEE — just for you', Icon: HealthIcon },
];

const SECTION_COMPONENTS: Record<Section, (props: { onBack: () => void }) => React.JSX.Element> = {
  chores: ChoresSection,
  groceries: GroceriesSection,
  pets: PetsSection,
  finances: FinancesSection,
  kids: KidsSection,
  health: HealthSection,
};

export default function HomeScreen() {
  const { household } = useHousehold();
  const [activeSection, setActiveSection] = useState<Section | null>(null);

  const ActiveSectionComponent = activeSection ? SECTION_COMPONENTS[activeSection] : null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {ActiveSectionComponent ? (
          <Animated.View
            key={activeSection}
            entering={SlideInRight.duration(220)}
            exiting={SlideOutRight.duration(180)}
            style={styles.sectionWrapper}>
            <ActiveSectionComponent onBack={() => setActiveSection(null)} />
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)} style={styles.hub}>
            <ThemedView style={styles.heroSection}>
              <ThemedText type="small" themeColor="textSecondary">
                Welcome home
              </ThemedText>
              <ThemedText type="title" style={styles.title}>
                {household?.name ?? 'Heimilið'}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.cardList}>
              {SECTIONS.map((section) => (
                <HubCard
                  key={section.key}
                  title={section.title}
                  hint={section.hint}
                  Icon={section.Icon}
                  onPress={() => setActiveSection(section.key)}
                />
              ))}
            </ThemedView>

            {Platform.OS === 'web' && <WebBadge />}
          </Animated.View>
        )}
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
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'stretch',
    // The web tab bar (app-tabs.web.tsx) is position: absolute over the
    // page, so content needs its own top offset to clear it. Spacing.six
    // alone lines up almost exactly flush with the tab bar's own bottom
    // edge (its own margin included) — add a bit more so there's an
    // actual visible gap instead of content nearly touching the tab bar.
    ...Platform.select({ web: { paddingTop: Spacing.six + Spacing.three } }),
  },
  hub: { flex: 1, alignItems: 'center', gap: Spacing.three },
  sectionWrapper: { flex: 1, alignSelf: 'stretch' },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    textAlign: 'center',
  },
  cardList: { alignSelf: 'stretch', gap: Spacing.two },
});
