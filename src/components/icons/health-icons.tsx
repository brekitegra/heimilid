import Svg, { Circle, Path } from 'react-native-svg';

import type { SectionIconProps } from '@/components/icons/section-icons';

// Feature-scoped icons for Health's own mini-hub — mirrors field-icons.tsx's
// role (small icons used only within one feature, not the top-level hub).

/** A bar chart — Today's macro tracker. */
export function TodayIcon({ color, size = 24 }: SectionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 20h3v-7H4v7zM10.5 20h3V4h-3v16zM17 20h3v-10h-3v10z" fill={color} />
    </Svg>
  );
}

/** A dumbbell — Training. */
export function TrainingIcon({ color, size = 24 }: SectionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M2 10h2v4H2v-4zm3-2.5h2v9H5v-9zm3 3.5h8v2H8v-2zm9-3.5h2v9h-2v-9zm3 2.5h2v4h-2v-4z" fill={color} />
    </Svg>
  );
}

/** A target — Profile's TDEE/macro targets. */
export function TargetIcon({ color, size = 24 }: SectionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth={2} />
      <Circle cx="12" cy="12" r="5" fill="none" stroke={color} strokeWidth={2} />
      <Circle cx="12" cy="12" r="1.7" fill={color} />
    </Svg>
  );
}
