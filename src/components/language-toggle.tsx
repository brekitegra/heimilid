import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useLanguage, useTranslation, type Language } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';

const LANGUAGE_OPTIONS: { code: Language; labelKey: 'english' | 'icelandic' }[] = [
  { code: 'en', labelKey: 'english' },
  { code: 'is', labelKey: 'icelandic' },
];

/** A small language switcher for the screens that come BEFORE a user is
 * in a household — auth-screen.tsx (sign in/up/forgot password) and
 * household-onboarding.tsx (create/join) — the only two places in the
 * app with no route to Profile's or the quick-menu's language pills.
 * Without this, a first-time user with nothing yet in AsyncStorage is
 * stuck reading English through the entire sign-up + onboarding flow,
 * since both existing switches require already being logged in.
 * Floats in the top-right corner rather than sitting inside the form —
 * both host screens are a single centered card with no header bar to
 * dock it into. */
export function LanguageToggle() {
  const theme = useTheme();
  const t = useTranslation();
  const insets = useSafeAreaInsets();
  const { language, setLanguage } = useLanguage();

  return (
    <View style={[styles.wrapper, { top: insets.top + Spacing.three, right: insets.right + Spacing.four }]}>
      <ThemedView type="backgroundElement" style={[styles.pillRow, { borderColor: theme.backgroundSelected, borderWidth: 1 }]}>
        {LANGUAGE_OPTIONS.map((option) => {
          const active = language === option.code;
          return (
            <Pressable key={option.code} onPress={() => setLanguage(option.code)} hitSlop={4}>
              <ThemedView
                type={active ? 'backgroundSelected' : 'background'}
                style={[styles.pill, active && { borderColor: theme.accent, borderWidth: 1 }]}>
                <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
                  {t(option.labelKey)}
                </ThemedText>
              </ThemedView>
            </Pressable>
          );
        })}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', zIndex: 10 },
  pillRow: { flexDirection: 'row', gap: Spacing.one, borderRadius: Spacing.three, padding: Spacing.half },
  pill: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.two, borderRadius: Spacing.two },
});
