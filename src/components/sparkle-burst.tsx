import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

const DOT_COUNT = 6;
const RADIUS = 26;
const DOT_SIZE = 6;
const DURATION = 500;

function Dot({ angle, delay, color }: { angle: number; delay: number; color: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: DURATION * 0.4, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: DURATION * 0.6, easing: Easing.in(Easing.cubic) })
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
        { scale: 0.4 + progress.value * 0.6 },
      ],
    };
  });

  return <Animated.View style={[styles.dot, { backgroundColor: color }, animatedStyle]} />;
}

/** A small celebratory burst of dots radiating outward — plays once when a
 * one-off chore is completed, right before it leaves the list. Purely
 * decorative; the caller is responsible for removing this after the chore
 * actually disappears. */
export function SparkleBurst() {
  const theme = useTheme();

  return (
    <Animated.View pointerEvents="none" style={styles.container}>
      {Array.from({ length: DOT_COUNT }, (_, i) => (
        <Dot key={i} angle={(i / DOT_COUNT) * Math.PI * 2} delay={i * 25} color={theme.accent} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});
