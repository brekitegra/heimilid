import Svg, { Circle, Ellipse, Path, Polygon } from 'react-native-svg';

export type SectionIconProps = { color: string; size?: number };

/** A checklist mark — chores. */
export function ChoresIcon({ color, size = 24 }: SectionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" fill={color} />
    </Svg>
  );
}

/** A simple paw print — pets. */
export function PetsIcon({ color, size = 24 }: SectionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Ellipse cx="12" cy="16" rx="6" ry="5" fill={color} />
      <Circle cx="5.5" cy="9" r="2.4" fill={color} />
      <Circle cx="18.5" cy="9" r="2.4" fill={color} />
      <Circle cx="9.3" cy="4.6" r="2.2" fill={color} />
      <Circle cx="14.7" cy="4.6" r="2.2" fill={color} />
    </Svg>
  );
}

/** A stack of coins — finances. */
export function FinancesIcon({ color, size = 24 }: SectionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Ellipse cx="12" cy="16.5" rx="7.5" ry="3" fill={color} />
      <Ellipse cx="12" cy="12.5" rx="7.5" ry="3" fill={color} />
      <Ellipse cx="12" cy="8.5" rx="7.5" ry="3" fill={color} />
    </Svg>
  );
}

/** A star — kids' activities. */
export function KidsIcon({ color, size = 24 }: SectionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polygon points="12,3 14.7,9.1 21.4,9.8 16.3,14.2 17.8,20.8 12,17.3 6.2,20.8 7.7,14.2 2.6,9.8 9.3,9.1" fill={color} />
    </Svg>
  );
}
