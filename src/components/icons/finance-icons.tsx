import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { SectionIconProps } from '@/components/icons/section-icons';

// Feature-scoped icons for Finances' own mini-hub — mirrors
// health-icons.tsx's role (small icons used only within one feature,
// not the top-level hub).

/** A 2x2 dashboard grid — Overview. */
export function OverviewIcon({ color, size = 24 }: SectionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="4" y="4" width="7" height="7" rx="1.5" fill={color} />
      <Rect x="13" y="4" width="7" height="7" rx="1.5" fill={color} />
      <Rect x="4" y="13" width="7" height="7" rx="1.5" fill={color} />
      <Rect x="13" y="13" width="7" height="7" rx="1.5" fill={color} />
    </Svg>
  );
}

/** A bulleted list — Expenses (recurring/one-off bills). */
export function ExpensesIcon({ color, size = 24 }: SectionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="4.5" cy="6" r="1.5" fill={color} />
      <Rect x="8" y="4.75" width="12" height="2.5" rx="1.25" fill={color} />
      <Circle cx="4.5" cy="12" r="1.5" fill={color} />
      <Rect x="8" y="10.75" width="12" height="2.5" rx="1.25" fill={color} />
      <Circle cx="4.5" cy="18" r="1.5" fill={color} />
      <Rect x="8" y="16.75" width="12" height="2.5" rx="1.25" fill={color} />
    </Svg>
  );
}

/** A percent glyph — Loans (interest-rate-driven payoff projections). */
export function LoansIcon({ color, size = 24 }: SectionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="7" cy="7" r="3.25" fill="none" stroke={color} strokeWidth={2} />
      <Circle cx="17" cy="17" r="3.25" fill="none" stroke={color} strokeWidth={2} />
      <Path d="M18 6 6 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** A flag on a pole — Savings (progress toward a goal). */
export function SavingsIcon({ color, size = 24 }: SectionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="5" y="3" width="2" height="18" rx="1" fill={color} />
      <Path d="M7 4 19 8 7 13Z" fill={color} />
    </Svg>
  );
}
