import { StyleSheet, View } from 'react-native';
import Svg, { Ellipse, Polygon } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

type Shape = 'star' | 'balloon' | 'kite';
type Spot = { shape: Shape; top: `${number}%`; left: `${number}%`; size: number; rotate: string; opacity: number };

// Mirrors pets-paw-background.tsx exactly — same low-opacity flat-fill
// scatter, same reasoning — but mixes in a couple of kid-specific shapes
// (a balloon, a kite) alongside the star reward icon, so the background
// reads as "kids" on its own rather than just echoing the star mechanic.
const SPOTS: Spot[] = [
  { shape: 'star', top: '4%', left: '10%', size: 38, rotate: '-12deg', opacity: 0.05 },
  { shape: 'balloon', top: '16%', left: '82%', size: 46, rotate: '8deg', opacity: 0.045 },
  { shape: 'kite', top: '40%', left: '6%', size: 42, rotate: '-16deg', opacity: 0.045 },
  { shape: 'star', top: '58%', left: '88%', size: 40, rotate: '20deg', opacity: 0.045 },
  { shape: 'balloon', top: '78%', left: '12%', size: 50, rotate: '-6deg', opacity: 0.04 },
  { shape: 'kite', top: '90%', left: '70%', size: 44, rotate: '22deg', opacity: 0.045 },
];

function Star({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polygon points="12,3 14.7,9.1 21.4,9.8 16.3,14.2 17.8,20.8 12,17.3 6.2,20.8 7.7,14.2 2.6,9.8 9.3,9.1" fill={color} />
    </Svg>
  );
}

function Balloon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Ellipse cx="12" cy="9" rx="7" ry="8" fill={color} />
      <Polygon points="10,17 14,17 12,20" fill={color} />
    </Svg>
  );
}

function Kite({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polygon points="12,2 20,10 12,22 4,10" fill={color} />
    </Svg>
  );
}

const SHAPE_COMPONENTS: Record<Shape, (props: { color: string; size: number }) => React.JSX.Element> = {
  star: Star,
  balloon: Balloon,
  kite: Kite,
};

/** A very subtle scatter of kid-themed shapes behind the Kids screen —
 * flat vector silhouettes matching the app's existing icon language
 * (never a photo), so it can't clash with the palette or break in dark
 * mode. Sits behind everything (negative zIndex) and never intercepts
 * touches; solid card backgrounds naturally hide it wherever real
 * content sits, so it only shows through in empty page space. */
export function KidsStarBackground() {
  const theme = useTheme();

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} pointerEvents="none">
      {SPOTS.map((spot, i) => {
        const Shape = SHAPE_COMPONENTS[spot.shape];
        return (
          <View
            key={i}
            style={[
              styles.spot,
              { top: spot.top, left: spot.left, opacity: spot.opacity, transform: [{ rotate: spot.rotate }] },
            ]}>
            <Shape color={theme.text} size={spot.size} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { zIndex: -1 },
  spot: { position: 'absolute' },
});
