import { FinancesIcon } from '@/components/icons/section-icons';
import { ComingSoonSection } from '@/components/sections/coming-soon-section';

export function FinancesSection({ onBack }: { onBack: () => void }) {
  return (
    <ComingSoonSection
      title="Finances"
      description="Shared accounts and recurring bills."
      Icon={FinancesIcon}
      onBack={onBack}
    />
  );
}
