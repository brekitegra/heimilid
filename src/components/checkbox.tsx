import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export type CheckboxProps = {
  checked: boolean;
  onToggle: () => void;
  size?: number;
  testID?: string;
};

/** A small square checkbox: unfilled with a themed border when unchecked,
 * filled with a checkmark when checked, with a small satisfying bounce
 * whenever it flips to checked. Used for "Remember me" and for marking
 * chores done. */
export function Checkbox({ checked, onToggle, size = 18, testID }: CheckboxProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (checked) {
      scale.value = withSequence(withTiming(1.35, { duration: 100 }), withSpring(1, { damping: 6, stiffness: 200 }));
    }
    // Only the moment it becomes checked should bounce, not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable onPress={onToggle} hitSlop={8} testID={testID}>
      <Animated.View
        style={[
          styles.box,
          { width: size, height: size, borderRadius: size / 4, borderColor: theme.backgroundSelected },
          checked && { backgroundColor: theme.accent, borderColor: theme.accent },
          animatedStyle,
        ]}>
        {checked && (
          <ThemedText type="smallBold" themeColor="background" style={{ fontSize: size * 0.7 }}>
            ✓
          </ThemedText>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
