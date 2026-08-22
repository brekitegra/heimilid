/* eslint-disable react-hooks/immutability --
 * This file drives its whole animation timeline by mutating Reanimated
 * shared values' `.value` from plain functions (the intro effect, and the
 * tap-to-skip handler) — that's Reanimated's normal, correct API, not a
 * React state mutation. The react-compiler-derived immutability check
 * doesn't know about SharedValue and flags every `.value =` as if it were
 * mutating a React-owned value.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Line, Polygon, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';

// The house is drawn 1:1 with the SVG viewBox below, so door/window
// coordinates can be reused directly as View style positions.
const HOUSE_SIZE = 240;

// Door position within the house (shared by the SVG doorway cutout and the
// door View drawn on top of it).
const DOOR = { left: 104, top: 140, width: 32, height: 60 };

// Timeline: house appears -> a short beat -> the door swings open on its
// hinge -> the whole scene fades up and away to reveal the sign-in form
// underneath. Tapping anywhere jumps straight to the end of that sequence.
const APPEAR_MS = 420;
const HOLD_MS = 350;
const DOOR_MS = 450;
const EXIT_DELAY_MS = 200;
const EXIT_MS = 380;

/**
 * A one-time-per-visit intro that sits above the auth screen: a house
 * illustration whose door swings open, then the whole thing fades away to
 * reveal the real sign-in form already mounted underneath. Auto-plays, but
 * tapping anywhere skips straight to the end.
 *
 * The door is a plain `View` laid directly over a static SVG house (rather
 * than an animated SVG shape) because Reanimated's web runtime mutates
 * animated SVG props as raw DOM attributes, bypassing react-native-svg's own
 * prop translation — `View` + `transform`/`transformOrigin` is the
 * cross-platform-proven path (it's what the rest of the app's animations use).
 */
export function HouseDoorIntro() {
  const theme = useTheme();
  const t = useTranslation();
  const [visible, setVisible] = useState(true);
  const finishedRef = useRef(false);

  const houseScale = useSharedValue(0.86);
  const houseOpacity = useSharedValue(0);
  const doorScaleX = useSharedValue(1);
  const overlayOpacity = useSharedValue(1);
  const overlayTranslateY = useSharedValue(0);

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setVisible(false);
  }

  useEffect(() => {
    houseOpacity.value = withTiming(1, { duration: APPEAR_MS, easing: Easing.out(Easing.cubic) });
    houseScale.value = withTiming(1, { duration: APPEAR_MS, easing: Easing.elastic(0.7) });

    doorScaleX.value = withDelay(
      APPEAR_MS + HOLD_MS,
      withTiming(0, { duration: DOOR_MS, easing: Easing.inOut(Easing.cubic) })
    );

    const exitAt = APPEAR_MS + HOLD_MS + DOOR_MS + EXIT_DELAY_MS;
    overlayOpacity.value = withDelay(
      exitAt,
      withTiming(0, { duration: EXIT_MS }, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(finish);
      })
    );
    overlayTranslateY.value = withDelay(
      exitAt,
      withTiming(-24, { duration: EXIT_MS, easing: Easing.in(Easing.cubic) })
    );
    // Runs once: this is a one-shot intro timeline, not a reactive effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function skip() {
    if (finishedRef.current) return;
    houseOpacity.value = 1;
    houseScale.value = 1;
    doorScaleX.value = withTiming(0, { duration: 150 });
    overlayOpacity.value = withDelay(
      120,
      withTiming(0, { duration: 200 }, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(finish);
      })
    );
    overlayTranslateY.value = withDelay(120, withTiming(-24, { duration: 200 }));
  }

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    transform: [{ translateY: overlayTranslateY.value }],
  }));

  const houseStyle = useAnimatedStyle(() => ({
    opacity: houseOpacity.value,
    transform: [{ scale: houseScale.value }],
  }));

  const doorStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: doorScaleX.value }],
  }));

  if (!visible) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('houseDoorSkipA11yLabel')}
      style={[styles.overlay, { backgroundColor: theme.background }]}
      onPress={skip}>
      <Animated.View style={[styles.content, overlayStyle]}>
        <Animated.View style={[styles.house, houseStyle]}>
          <Svg width={HOUSE_SIZE} height={HOUSE_SIZE} viewBox={`0 0 ${HOUSE_SIZE} ${HOUSE_SIZE}`}>
            <Rect x={30} y={200} width={180} height={4} rx={2} fill={theme.backgroundSelected} />

            <Rect x={60} y={90} width={120} height={110} fill={theme.backgroundElement} />
            <Polygon points="46,92 120,28 194,92" fill={theme.backgroundElement} />
            <Rect x={150} y={44} width={16} height={34} fill={theme.backgroundElement} />

            <Rect x={75} y={110} width={28} height={28} rx={3} fill={theme.background} />
            <Line x1={89} y1={110} x2={89} y2={138} stroke={theme.backgroundSelected} strokeWidth={2} />
            <Line x1={75} y1={124} x2={103} y2={124} stroke={theme.backgroundSelected} strokeWidth={2} />

            <Rect x={137} y={110} width={28} height={28} rx={3} fill={theme.background} />
            <Line x1={151} y1={110} x2={151} y2={138} stroke={theme.backgroundSelected} strokeWidth={2} />
            <Line x1={137} y1={124} x2={165} y2={124} stroke={theme.backgroundSelected} strokeWidth={2} />

            {/* Doorway interior, revealed as the door View in front of it swings open */}
            <Rect x={DOOR.left} y={DOOR.top} width={DOOR.width} height={DOOR.height} fill="#1A0F08" />
          </Svg>

          {/* The door itself: hinged on its left edge, swinging open over the doorway above */}
          <Animated.View style={[styles.door, { backgroundColor: theme.accent }, doorStyle]}>
            <View style={[styles.doorknob, { backgroundColor: theme.background }]} />
          </Animated.View>
        </Animated.View>

        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          {t('houseDoorTapToSkip')}
        </ThemedText>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  content: {
    alignItems: 'center',
    gap: Spacing.four,
  },
  house: {
    width: HOUSE_SIZE,
    height: HOUSE_SIZE,
  },
  door: {
    position: 'absolute',
    left: DOOR.left,
    top: DOOR.top,
    width: DOOR.width,
    height: DOOR.height,
    borderRadius: 2,
    transformOrigin: 'left center',
  },
  doorknob: {
    position: 'absolute',
    right: 6,
    top: DOOR.height / 2 - 2.5,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  hint: {
    textAlign: 'center',
  },
});
