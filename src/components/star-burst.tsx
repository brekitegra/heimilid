import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';

const STAR_POINTS = '12,3 14.7,9.1 21.4,9.8 16.3,14.2 17.8,20.8 12,17.3 6.2,20.8 7.7,14.2 2.6,9.8 9.3,9.1';
const STAR_COLOR = '#c9a227';

const RAY_COUNT = 6;
const RADIUS = 30;
const RAY_SIZE = 10;
const CENTER_SIZE = 22;
const DURATION = 550;

function StarShape({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polygon points={STAR_POINTS} fill={STAR_COLOR} />
    </Svg>
  );
}

function Ray({ angle, delay }: { angle: number; delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: DURATION * 0.45, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: DURATION * 0.55, easing: Easing.in(Easing.cubic) })
      )
    );
    // One-shot burst on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const distance = progress.value * RADIUS;
    return {
      opacity: progress.value,
      transform: [
        { translateX: Math.cos(angle) * distance },
        { translateY: Math.sin(angle) * distance },
        { rotate: `${progress.value * 90}deg` },
        { scale: 0.5 + progress.value * 0.6 },
      ],
    };
  });

  return (
    <Animated.View style={[styles.ray, animatedStyle]}>
      <StarShape size={RAY_SIZE} />
    </Animated.View>
  );
}

/** A little celebration specifically for earning a star — a central star
 * pops in with a bouncy spring + spin while a handful of mini stars
 * radiate outward. Distinct from (and a bit more festive than) the
 * plain-dot SparkleBurst Chores/Pets use, so Kids' reward moment feels
 * like its own thing. Fires every time a star is actually earned, not
 * just on a one-off item's final completion — a recurring chore/activity
 * gets the same little celebration each time it's checked off. Plays
 * once on mount; purely decorative, doesn't affect layout. */
export function StarBurst() {
  const centerScale = useSharedValue(0);
  const centerRotate = useSharedValue(-30);

  useEffect(() => {
    centerScale.value = withSequence(
      withTiming(1.3, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 7, stiffness: 180 })
    );
    centerRotate.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
    // One-shot on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const centerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: centerScale.value }, { rotate: `${centerRotate.value}deg` }],
  }));

  return (
    <Animated.View pointerEvents="none" style={styles.container}>
      {Array.from({ length: RAY_COUNT }, (_, i) => (
        <Ray key={i} angle={(i / RAY_COUNT) * Math.PI * 2} delay={i * 30} />
      ))}
      <Animated.View style={centerStyle}>
        <StarShape size={CENTER_SIZE} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ray: {
    position: 'absolute',
  },
});
