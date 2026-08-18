import { PetsIcon } from '@/components/icons/section-icons';
import { ComingSoonSection } from '@/components/sections/coming-soon-section';

export function PetsSection({ onBack }: { onBack: () => void }) {
  return (
    <ComingSoonSection
      title="Pets"
      description="Feeding schedules, vet visits, and care notes."
      Icon={PetsIcon}
      onBack={onBack}
    />
  );
}
