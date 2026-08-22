import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { NavArrowButton } from '@/components/nav-arrow-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation, type TranslationKey } from '@/hooks/use-language';
import { toLocalISODate } from '@/lib/practice-format';

export type CalendarMarker = { color: string };

export type CalendarMonthViewProps = {
  /** Any date within the month to display — only its year/month matter. */
  month: Date;
  onMonthChange: (next: Date) => void;
  /** Keyed by YYYY-MM-DD (toLocalISODate). */
  markersByDate: Map<string, CalendarMarker[]>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
};

// Sunday-first, matching the grid's column order (leadingBlanks below is
// firstOfMonth.getDay(), 0 = Sunday).
const WEEKDAY_INITIAL_KEYS: TranslationKey[] = [
  'weekdayInitialSun',
  'weekdayInitialMon',
  'weekdayInitialTue',
  'weekdayInitialWed',
  'weekdayInitialThu',
  'weekdayInitialFri',
  'weekdayInitialSat',
];
const MONTH_NAME_KEYS: TranslationKey[] = [
  'monthJanuary', 'monthFebruary', 'monthMarch', 'monthApril', 'monthMay', 'monthJune',
  'monthJuly', 'monthAugust', 'monthSeptember', 'monthOctober', 'monthNovember', 'monthDecember',
];

/** A lightweight, hand-rolled month grid — no external calendar
 * dependency, matching how the rest of the app hand-builds its custom UI.
 * Purely a browsing surface (tap a day to select it; the caller renders
 * that day's agenda below) rather than a full drag/edit calendar editor —
 * creating and editing items still happens through the normal composers. */
export function CalendarMonthView({ month, onMonthChange, markersByDate, selectedDate, onSelectDate }: CalendarMonthViewProps) {
  const theme = useTheme();
  const t = useTranslation();
  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  const weeks = useMemo(() => {
    const firstOfMonth = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const leadingBlanks = firstOfMonth.getDay();

    const cells: (Date | null)[] = [];
    for (let i = 0; i < leadingBlanks; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, monthIndex, d));
    while (cells.length % 7 !== 0) cells.push(null);

    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [year, monthIndex]);

  const today = toLocalISODate(new Date());

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <NavArrowButton direction="prev" onPress={() => onMonthChange(new Date(year, monthIndex - 1, 1))} />
        <ThemedText type="smallBold">
          {t(MONTH_NAME_KEYS[monthIndex])} {year}
        </ThemedText>
        <NavArrowButton direction="next" onPress={() => onMonthChange(new Date(year, monthIndex + 1, 1))} />
      </View>

      <View style={styles.weekRow}>
        {WEEKDAY_INITIAL_KEYS.map((key, i) => (
          <ThemedText key={i} type="small" themeColor="textSecondary" style={styles.weekdayLabel}>
            {t(key)}
          </ThemedText>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((date, di) => {
            if (!date) return <View key={di} style={styles.dayCell} />;
            const iso = toLocalISODate(date);
            const markers = markersByDate.get(iso) ?? [];
            const isToday = iso === today;
            const isSelected = iso === selectedDate;

            return (
              <Pressable key={di} onPress={() => onSelectDate(iso)} style={styles.dayCell}>
                <View
                  style={[
                    styles.dayCircle,
                    isSelected && { backgroundColor: theme.accent },
                    !isSelected && isToday && { borderColor: theme.accent, borderWidth: 1 },
                  ]}>
                  <ThemedText type="small" themeColor={isSelected ? 'background' : 'text'}>
                    {date.getDate()}
                  </ThemedText>
                </View>
                <View style={styles.dotsRow}>
                  {markers.slice(0, 3).map((m, mi) => (
                    <View key={mi} style={[styles.dot, { backgroundColor: m.color }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.two },
  weekRow: { flexDirection: 'row' },
  weekdayLabel: { flex: 1, textAlign: 'center' },
  dayCell: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: Spacing.one },
  dayCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dotsRow: { flexDirection: 'row', gap: 2, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
});
