import { ProgressBar } from '@/components/progress-bar';
import { useTheme } from '@/hooks/use-theme';
import { xpProgressForLevel } from '@/lib/xp';

export type XpProgressBarProps = {
  xp: number;
  height?: number;
};

/** A thin fill bar showing progress toward the next level — animates its
 * width in on mount (and again whenever xp itself changes), rather than
 * just snapping to the final value. */
export function XpProgressBar({ xp, height = 8 }: XpProgressBarProps) {
  const theme = useTheme();
  const { progress } = xpProgressForLevel(xp);
  return <ProgressBar progress={progress} color={theme.accent} height={height} />;
}
