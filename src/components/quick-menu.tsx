import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { LegalLinks } from '@/components/legal-links';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useHousehold } from '@/hooks/use-household';
import { useLanguage, useTranslation, type Language, type TranslationKey } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference, type ThemePreference } from '@/hooks/use-theme-preference';
import { showAlert } from '@/lib/alert';
import { shareHouseholdInvite } from '@/lib/share-invite';
import { supabase } from '@/lib/supabase';

const LANGUAGE_OPTIONS: { code: Language; labelKey: 'english' | 'icelandic' }[] = [
  { code: 'en', labelKey: 'english' },
  { code: 'is', labelKey: 'icelandic' },
];

// Same three-way choice as Profile's Appearance card (use-theme-preference.tsx) —
// this is a second, faster-to-reach entry point to the identical setting,
// not a separate preference.
const APPEARANCE_OPTIONS: { key: ThemePreference; labelKey: TranslationKey }[] = [
  { key: 'system', labelKey: 'system' },
  { key: 'light', labelKey: 'light' },
  { key: 'dark', labelKey: 'dark' },
];

/** A small always-available menu living in the web tab bar itself,
 * alongside Home/Household/Notes/Profile — the fast path to the handful
 * of actions people reach for constantly (switch language, invite
 * someone, log out) without a full trip to the Profile tab, which still
 * has the complete version of all three (plus everything else). Web
 * only: the native tab bar (app-tabs.tsx) is rendered by the OS via
 * NativeTabs, which has no slot for a non-navigational item like this
 * one — native users reach the same three actions through Profile
 * itself. Calls `supabase.auth.signOut()` directly rather than going
 * through use-profile.tsx's `signOut` — that function is just this one
 * line with no dependency on the rest of that hook's (heavier)
 * profile-fetch state, so pulling in the whole hook here would only add
 * a second, wasted profile fetch alongside whatever's already loaded on
 * the Profile screen. */
export function QuickMenu() {
  const theme = useTheme();
  const t = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { preference, setPreference } = useThemePreference();
  const { household } = useHousehold();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleInvite() {
    setOpen(false);
    if (!household) return;
    await shareHouseholdInvite(household, language);
  }

  // No "are you sure?" here on purpose — logging out isn't destructive
  // (you can always sign back in), so it just happens on tap rather than
  // demanding an extra confirmation click.
  async function handleLogOut() {
    setOpen(false);
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      showAlert(t('profileLogOutError'), err instanceof Error ? err.message : t('genericErrorMessage'));
      setLoggingOut(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        disabled={loggingOut}
        hitSlop={8}
        style={[styles.icon, { backgroundColor: theme.backgroundSelected }]}
        accessibilityLabel={t('quickMenu')}>
        <ThemedText type="default" style={styles.iconGlyph}>
          ⋮
        </ThemedText>
      </Pressable>

      {open && (
        <>
          {/* Full-viewport, invisible — a tap anywhere outside the menu
              closes it, matching how every other web dropdown behaves.
              position: 'fixed' is web-only CSS (this component is only
              ever mounted from app-tabs.web.tsx), rendered behind the
              menu itself via document order, not zIndex trickery. */}
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel={t('cancel')} />
          <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={styles.menuWrapper}>
            <ThemedView type="backgroundElement" style={[styles.menu, { borderColor: theme.backgroundSelected, borderWidth: 1 }]}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.menuHeader}>
                {t('appearance')}
              </ThemedText>
              <View style={styles.languageRow}>
                {APPEARANCE_OPTIONS.map((option) => {
                  const active = preference === option.key;
                  return (
                    <Pressable key={option.key} onPress={() => setPreference(option.key)} style={styles.languagePill}>
                      <ThemedView
                        type={active ? 'backgroundSelected' : 'background'}
                        style={[styles.languagePillInner, active && { borderColor: theme.accent, borderWidth: 1 }]}>
                        <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
                          {t(option.labelKey)}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  );
                })}
              </View>

              <ThemedText type="small" themeColor="textSecondary" style={styles.menuHeader}>
                {t('language')}
              </ThemedText>
              <View style={styles.languageRow}>
                {LANGUAGE_OPTIONS.map((option) => {
                  const active = language === option.code;
                  return (
                    <Pressable key={option.code} onPress={() => setLanguage(option.code)} style={styles.languagePill}>
                      <ThemedView
                        type={active ? 'backgroundSelected' : 'background'}
                        style={[styles.languagePillInner, active && { borderColor: theme.accent, borderWidth: 1 }]}>
                        <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
                          {t(option.labelKey)}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable onPress={handleInvite} style={styles.menuItem} hitSlop={4}>
                <ThemedText type="small">{t('inviteMember')}</ThemedText>
              </Pressable>

              <Pressable onPress={handleLogOut} disabled={loggingOut} style={styles.menuItem} hitSlop={4}>
                <ThemedText type="small" style={styles.logOutText}>
                  {loggingOut ? '…' : t('logOut')}
                </ThemedText>
              </Pressable>

              <View style={[styles.legalRow, { borderTopColor: theme.backgroundSelected }]}>
                <LegalLinks />
              </View>
            </ThemedView>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // A plain (non-absolute) wrapper — this sits inline as a flex item at
  // the end of the tab bar's own pill (see app-tabs.web.tsx), right
  // alongside Home/Household/Notes/Profile, not a separate floating
  // corner circle. The dropdown itself still positions relative to this
  // wrapper via `menuWrapper`.
  wrapper: { position: 'relative' },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { fontSize: 24, lineHeight: 26 },
  // top: '100%' + a margin (rather than a hardcoded pixel value) so this
  // stays correctly positioned right under the icon regardless of the
  // icon's own size or the pill's padding, instead of a number that
  // silently drifts out of sync whenever either changes.
  menuWrapper: { position: 'absolute', top: '100%', marginTop: Spacing.two, right: 0, zIndex: 20 },
  // A full-viewport invisible layer beneath the menu — closes it on any
  // outside tap. Fixed positioning (web-only CSS) covers the whole
  // browser viewport regardless of scroll, not just this component's
  // own bounds.
  backdrop: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 15 },
  menu: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two, minWidth: 200 },
  menuHeader: { letterSpacing: 0.5 },
  languageRow: { flexDirection: 'row', gap: Spacing.two },
  // minWidth: 0 — same web flexbox fix as Profile's identical
  // appearanceOption style: without it, the longest label (e.g.
  // "Kerfi"/"System") refuses to shrink and pushes the other pills out
  // past the menu's edge instead of all three dividing the space evenly.
  languagePill: { flex: 1, minWidth: 0 },
  languagePillInner: { alignItems: 'center', paddingVertical: Spacing.one, borderRadius: Spacing.two },
  menuItem: { paddingVertical: Spacing.one },
  // A visually separate row below Log out — legal links aren't an
  // "action" like the items above them, so they get their own divider
  // rather than blending into the same list.
  legalRow: { borderTopWidth: 1, marginTop: Spacing.one, paddingTop: Spacing.two },
  logOutText: { color: '#e5484d' },
});
