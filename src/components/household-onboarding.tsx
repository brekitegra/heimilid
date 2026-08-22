import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LanguageToggle } from '@/components/language-toggle';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useHousehold } from '@/hooks/use-household';
import { useTranslation } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';

type Mode = 'create' | 'join';

export function HouseholdOnboarding() {
  const theme = useTheme();
  const t = useTranslation();
  const { createHousehold, joinHousehold } = useHousehold();
  const [mode, setMode] = useState<Mode>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (mode === 'create' && !name.trim()) {
      showAlert(t('householdOnboardingNameRequired'));
      return;
    }
    if (mode === 'join' && !code.trim()) {
      showAlert(t('householdOnboardingCodeRequired'));
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'create') {
        await createHousehold(name.trim());
      } else {
        await joinHousehold(code.trim());
      }
    } catch (err) {
      showAlert(
        mode === 'create' ? t('householdOnboardingCreateError') : t('householdOnboardingJoinError'),
        err instanceof Error ? err.message : t('genericErrorMessage')
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <LanguageToggle />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={[styles.form, { borderColor: theme.backgroundSelected }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}>
          <ThemedText type="title" style={styles.title}>
            {t('householdOnboardingTitle')}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            {t('householdOnboardingSubtitle')}
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.tabs}>
            <Pressable
              style={[styles.tab, mode === 'create' && { backgroundColor: theme.backgroundSelected }]}
              onPress={() => setMode('create')}>
              <ThemedText type="smallBold">{t('householdOnboardingCreateTab')}</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.tab, mode === 'join' && { backgroundColor: theme.backgroundSelected }]}
              onPress={() => setMode('join')}>
              <ThemedText type="smallBold">{t('householdOnboardingJoinTab')}</ThemedText>
            </Pressable>
          </ThemedView>

          {mode === 'create' ? (
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, color: theme.text }]}
              placeholder={t('householdOnboardingNamePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={name}
              onChangeText={setName}
            />
          ) : (
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, color: theme.text }]}
              placeholder={t('householdOnboardingCodePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="characters"
              value={code}
              onChangeText={setCode}
            />
          )}

          <Pressable
            style={[styles.submit, { backgroundColor: theme.accent, opacity: submitting ? 0.6 : 1 }]}
            disabled={submitting}
            onPress={handleSubmit}>
            {submitting ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText type="smallBold" themeColor="background">
                {mode === 'create' ? t('householdOnboardingCreateButton') : t('householdOnboardingJoinButton')}
              </ThemedText>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four },
  // Same fix as auth-screen.tsx — capped and centered instead of
  // stretching edge-to-edge on a wide (web) viewport.
  form: {
    gap: Spacing.four,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 460,
    borderWidth: 1,
    borderRadius: Spacing.four,
    padding: Spacing.five,
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: Spacing.two },
  tabs: { flexDirection: 'row', borderRadius: Spacing.three, padding: Spacing.half },
  tab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Spacing.two },
  input: { borderWidth: 1, borderRadius: Spacing.two, paddingVertical: Spacing.three + Spacing.half, paddingHorizontal: Spacing.four },
  submit: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Spacing.two, marginTop: Spacing.two },
});
