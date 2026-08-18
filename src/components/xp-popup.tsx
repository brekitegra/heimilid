import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const RISE_DISTANCE = 28;
const DURATION = 900;

/** A "+10 XP" that floats up and fades out over the checkbox that earned
 * it, then calls `onDone` so the caller can drop it from whatever list is
 * tracking active popups. Purely decorative — doesn't affect layout. */
export function XpPopup({ amount, onDone }: { amount: number; onDone: () => void }) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) }, (finished) => {
      'worklet';
      if (finished) runOnJS(onDone)();
    });
    // Plays once on mount; onDone is stable enough for this one-shot timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: -progress.value * RISE_DISTANCE }, { scale: 1 + progress.value * 0.15 }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.container, animatedStyle]}>
      <ThemedText type="smallBold" style={{ color: theme.accent }}>
        +{amount} XP
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: -4, left: 0 },
});
