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
import { BottomTabInset, MaxContentWidth, Spacing, WebTabBarHeight } from '@/constants/theme';
import { useHousehold } from '@/hooks/use-household';
import { useTranslation, type TranslationKey } from '@/hooks/use-language';

type Section = 'chores' | 'groceries' | 'pets' | 'finances' | 'kids' | 'health';

const SECTIONS: { key: Section; titleKey: TranslationKey; hintKey: TranslationKey; Icon: typeof ChoresIcon }[] = [
  { key: 'chores', titleKey: 'choresTitle', hintKey: 'choresHint', Icon: ChoresIcon },
  { key: 'groceries', titleKey: 'groceriesTitle', hintKey: 'groceriesHint', Icon: GroceriesIcon },
  { key: 'pets', titleKey: 'petsTitle', hintKey: 'petsHint', Icon: PetsIcon },
  { key: 'finances', titleKey: 'financesTitle', hintKey: 'financesHint', Icon: FinancesIcon },
  { key: 'kids', titleKey: 'kidsTitle', hintKey: 'kidsHint', Icon: KidsIcon },
  { key: 'health', titleKey: 'healthTitle', hintKey: 'healthHint', Icon: HealthIcon },
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
  const t = useTranslation();
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
                {t('welcomeHome')}
              </ThemedText>
              <ThemedText type="title" style={styles.title}>
                {household?.name ?? t('tabHome')}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.cardList}>
              {SECTIONS.map((section) => (
                <HubCard
                  key={section.key}
                  title={t(section.titleKey)}
                  hint={t(section.hintKey)}
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
    // WebTabBarHeight clears the tab bar's own bottom edge exactly;
    // the extra Spacing.three on top of that is a real visible gap
    // instead of content nearly touching the bar.
    ...Platform.select({ web: { paddingTop: WebTabBarHeight + Spacing.three } }),
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
