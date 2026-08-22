import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutRight } from 'react-native-reanimated';

import { BackButton } from '@/components/back-button';
import { HubCard } from '@/components/hub-card';
import { ExpensesIcon, LoansIcon, OverviewIcon, SavingsIcon } from '@/components/icons/finance-icons';
import { Spacing } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-language';
import { FinancesExpensesSection } from '@/components/sections/finances-expenses-section';
import { FinancesLoansSection } from '@/components/sections/finances-loans-section';
import { FinancesOverviewSection } from '@/components/sections/finances-overview-section';
import { FinancesSavingsSection } from '@/components/sections/finances-savings-section';

type FinanceTab = 'overview' | 'expenses' | 'loans' | 'savings';

const TAB_COMPONENTS: Record<FinanceTab, (props: { onBack: () => void }) => React.JSX.Element> = {
  overview: FinancesOverviewSection,
  expenses: FinancesExpensesSection,
  loans: FinancesLoansSection,
  savings: FinancesSavingsSection,
};

/** Finances' own mini-hub — the exact same card-grid + slide-transition
 * pattern the top-level Home hub (and Health's mini-hub) use, one level
 * deeper, so navigating within Finances feels instantly familiar. */
export function FinancesSection({ onBack }: { onBack: () => void }) {
  const t = useTranslation();
  const [activeTab, setActiveTab] = useState<FinanceTab | null>(null);
  const ActiveTabComponent = activeTab ? TAB_COMPONENTS[activeTab] : null;

  const TABS: { key: FinanceTab; title: string; hint: string; Icon: typeof OverviewIcon }[] = [
    { key: 'overview', title: t('financesTabOverview'), hint: t('financesTabOverviewHint'), Icon: OverviewIcon },
    { key: 'expenses', title: t('financesTabExpenses'), hint: t('financesTabExpensesHint'), Icon: ExpensesIcon },
    { key: 'loans', title: t('financesTabLoans'), hint: t('financesTabLoansHint'), Icon: LoansIcon },
    { key: 'savings', title: t('financesTabSavings'), hint: t('financesTabSavingsHint'), Icon: SavingsIcon },
  ];

  return (
    <View style={styles.container}>
      {ActiveTabComponent ? (
        <Animated.View key={activeTab} entering={SlideInRight.duration(220)} exiting={SlideOutRight.duration(180)} style={styles.tabWrapper}>
          <ActiveTabComponent onBack={() => setActiveTab(null)} />
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)} style={styles.hub}>
          <View style={styles.header}>
            <BackButton label={t('home')} onPress={onBack} />
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
