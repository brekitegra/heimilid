import { KidsIcon } from '@/components/icons/section-icons';
import { ComingSoonSection } from '@/components/sections/coming-soon-section';

export function KidsSection({ onBack }: { onBack: () => void }) {
  return (
    <ComingSoonSection
      title="Kids"
      description="Practices and activity schedules."
      Icon={KidsIcon}
      onBack={onBack}
    />
  );
}
