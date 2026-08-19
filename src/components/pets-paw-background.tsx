import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

type PawSpot = { top: `${number}%`; left: `${number}%`; size: number; rotate: string; opacity: number };

// Hand-picked scatter, not randomized — a few varied sizes/rotations reads
// as deliberate texture instead of visual noise. Kept off the very center
// of the screen so it never fights with card content sitting on top.
const PAW_SPOTS: PawSpot[] = [
  { top: '3%', left: '76%', size: 72, rotate: '-18deg', opacity: 0.05 },
  { top: '20%', left: '4%', size: 46, rotate: '14deg', opacity: 0.045 },
  { top: '46%', left: '86%', size: 58, rotate: '24deg', opacity: 0.045 },
  { top: '64%', left: '2%', size: 80, rotate: '-10deg', opacity: 0.04 },
  { top: '84%', left: '68%', size: 52, rotate: '16deg', opacity: 0.045 },
];

function Paw({ color, size }: { color: string; size: number }) {
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

/** A very subtle scatter of paw prints behind the Pets screen — pure
 * flat-fill vector shapes (the same paw path as PetsIcon), never a
 * photo, so it can't clash with the app's monochrome icon language or
 * break in dark mode. Sits behind everything (negative zIndex) and never
 * intercepts touches; solid card backgrounds naturally hide it wherever
 * real content sits, so it only shows through in the empty page space. */
export function PetsPawBackground() {
  const theme = useTheme();

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} pointerEvents="none">
      {PAW_SPOTS.map((spot, i) => (
        <View
          key={i}
          style={[
            styles.spot,
            { top: spot.top, left: spot.left, opacity: spot.opacity, transform: [{ rotate: spot.rotate }] },
          ]}>
          <Paw color={theme.text} size={spot.size} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { zIndex: -1 },
  spot: { position: 'absolute' },
});
