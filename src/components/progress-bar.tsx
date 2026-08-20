import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

export type ProgressBarProps = {
  /** 0–1; clamped internally, so callers don't need to. */
  progress: number;
  color: string;
  height?: number;
};

/** A thin animated fill bar — pulled out of xp-progress-bar.tsx once a
 * second feature (Health's macro bars) needed the exact same generic
 * "animate a fill width in" behavior with a different color and a
 * non-XP progress source. `XpProgressBar` now delegates to this. */
export function ProgressBar({ progress, color, height = 8 }: ProgressBarProps) {
  const theme = useTheme();
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.max(0, Math.min(1, progress)), { duration: 600 });
  }, [progress, width]);

  const animatedStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: theme.backgroundSelected }]}>
      <Animated.View style={[styles.fill, { borderRadius: height / 2, backgroundColor: color }, animatedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { alignSelf: 'stretch', overflow: 'hidden' },
  fill: { height: '100%' },
});
