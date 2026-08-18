import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

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
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(progress, { duration: 600 });
  }, [progress, width]);

  const animatedStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: theme.backgroundSelected }]}>
      <Animated.View style={[styles.fill, { borderRadius: height / 2, backgroundColor: theme.accent }, animatedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { alignSelf: 'stretch', overflow: 'hidden' },
  fill: { height: '100%' },
});
