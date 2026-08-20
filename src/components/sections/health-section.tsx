import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutRight } from 'react-native-reanimated';

import { BackButton } from '@/components/back-button';
import { HubCard } from '@/components/hub-card';
import { TargetIcon, TodayIcon, TrainingIcon } from '@/components/icons/health-icons';
import { Spacing } from '@/constants/theme';
import { HealthProfileSection } from '@/components/sections/health-profile-section';
import { HealthTodaySection } from '@/components/sections/health-today-section';
import { HealthTrainingSection } from '@/components/sections/health-training-section';

type HealthTab = 'today' | 'training' | 'profile';

const TABS: { key: HealthTab; title: string; hint: string; Icon: typeof TodayIcon }[] = [
  { key: 'today', title: 'Today', hint: "Log food, see today's macros", Icon: TodayIcon },
  { key: 'training', title: 'Training', hint: 'Workouts, sets, and reps', Icon: TrainingIcon },
  { key: 'profile', title: 'Profile', hint: 'TDEE calculator and targets', Icon: TargetIcon },
];

const TAB_COMPONENTS: Record<HealthTab, (props: { onBack: () => void }) => React.JSX.Element> = {
  today: HealthTodaySection,
  training: HealthTrainingSection,
  profile: HealthProfileSection,
};

/** Health's own mini-hub — the exact same card-grid + slide-transition
 * pattern the top-level Home hub uses to get into a section in the first
 * place, one level deeper. Chosen so navigating within Health feels
 * instantly familiar rather than introducing a new UI language. */
export function HealthSection({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<HealthTab | null>(null);
  const ActiveTabComponent = activeTab ? TAB_COMPONENTS[activeTab] : null;

  return (
    <View style={styles.container}>
      {ActiveTabComponent ? (
        <Animated.View key={activeTab} entering={SlideInRight.duration(220)} exiting={SlideOutRight.duration(180)} style={styles.tabWrapper}>
          <ActiveTabComponent onBack={() => setActiveTab(null)} />
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)} style={styles.hub}>
          <View style={styles.header}>
            <BackButton label="Home" onPress={onBack} />
          </View>

          <View style={styles.cardList}>
            {TABS.map((tab) => (
              <HubCard key={tab.key} title={tab.title} hint={tab.hint} Icon={tab.Icon} onPress={() => setActiveTab(tab.key)} />
            ))}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignSelf: 'stretch' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.four },
  hub: { flex: 1, alignSelf: 'stretch' },
  cardList: { gap: Spacing.two },
  tabWrapper: { flex: 1, alignSelf: 'stretch' },
});
