import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type BreakdownSegment = { value: number; color: string };

/** A horizontal bar split into proportional colored segments — plain
 * flex Views, no SVG, same approach as ProgressBar's single-segment fill
 * just generalized to N segments. Segments with a non-positive value are
 * skipped entirely (a `flex: 0` child still reserves zero width, but
 * skipping avoids a stray empty View). Renders an empty track when every
 * value is 0, rather than dividing by zero. */
export function BreakdownBar({ segments, height = 16 }: { segments: BreakdownSegment[]; height?: number }) {
  const theme = useTheme();
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: theme.backgroundSelected }]}>
      {total > 0 &&
        segments.map((s, i) => (s.value > 0 ? <View key={i} style={{ flex: s.value, backgroundColor: s.color }} /> : null))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignSelf: 'stretch', overflow: 'hidden' },
});
