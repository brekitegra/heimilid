import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { Checkbox } from '@/components/checkbox';
import { LockIcon, MailIcon } from '@/components/icons/field-icons';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/constants/legal';
import { Spacing } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';
import { SUPABASE_AUTH_STORAGE_KEY, getAuthCallbackUrl, supabase } from '@/lib/supabase';

type Mode = 'signIn' | 'signUp' | 'forgotPassword';

export function AuthScreen() {
  const theme = useTheme();
  const t = useTranslation();
  const COPY: Record<Mode, { title: string; subtitle?: string }> = {
    signIn: { title: t('authWelcomeBack') },
    signUp: { title: t('authCreateAccountTitle') },
    forgotPassword: { title: t('authResetPasswordTitle'), subtitle: t('authResetPasswordSubtitle') },
  };
  const [mode, setMode] = useState<Mode>('signIn');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (mode === 'forgotPassword') {
      if (!email.trim()) {
        showAlert(t('authEnterEmail'));
        return;
      }
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: getAuthCallbackUrl(),
      });
      setLoading(false);
      if (error) {
        showAlert(t('authResetEmailErrorTitle'), error.message);
      } else {
        showAlert(t('authCheckEmailTitle'), t('authResetLinkSentBody', { email: email.trim() }));
        setMode('signIn');
      }
      return;
    }

    if (!email.trim() || !password) {
      showAlert(t('authEnterEmailAndPassword'));
      return;
    }

    setLoading(true);
    if (mode === 'signUp') {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() || undefined },
          emailRedirectTo: getAuthCallbackUrl(),
        },
      });
      setLoading(false);
      if (error) showAlert(t('authSignUpErrorTitle'), error.message);
      else showAlert(t('authAccountCreatedTitle'), t('authAccountCreatedBody'));
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (!error && !rememberMe) {
        // "Remember me" off: this session stays active until the app fully
        // restarts, but strip the just-persisted copy so a future cold
        // start won't restore it and requires signing in again.
        await AsyncStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
      }
      setLoading(false);
      if (error) showAlert(t('authSignInErrorTitle'), error.message);
    }
  }

  const copy = COPY[mode];

  return (
    <ThemedView style={styles.container}>
      <LanguageToggle />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={[styles.form, { borderColor: theme.backgroundSelected }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}>
          <ThemedView type="backgroundElement" style={styles.badge}>
            <Image style={styles.badgeIcon} source={require('@/assets/images/android-icon-foreground.png')} />
          </ThemedView>

          <ThemedText type="subtitle" style={styles.title}>
            {copy.title}
          </ThemedText>

          {mode === 'forgotPassword' ? (
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              {copy.subtitle}
            </ThemedText>
          ) : (
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              {mode === 'signUp' ? t('authAlreadyHaveAccount') : t('authNoAccountYet')}
              <ThemedText
                type="linkPrimary"
                style={styles.subtitleLink}
                onPress={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}>
                {mode === 'signUp' ? t('authSignInLink') : t('authSignUpLink')}
              </ThemedText>
            </ThemedText>
          )}

          {mode === 'signUp' && (
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, color: theme.text },
              ]}
              placeholder={t('authNamePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={fullName}
              onChangeText={setFullName}
            />
          )}

          <View style={styles.inputWrapper}>
            <View style={styles.inputIcon}>
              <MailIcon color={theme.textSecondary} size={18} />
            </View>
            <TextInput
              style={[
                styles.input,
                styles.inputWithIcon,
                { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, color: theme.text },
              ]}
              placeholder={t('authEmailPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {mode !== 'forgotPassword' && (
            <View style={styles.passwordWrapper}>
              <View style={styles.inputIcon}>
                <LockIcon color={theme.textSecondary} size={18} />
              </View>
              <TextInput
                style={[
                  styles.input,
                  styles.inputWithIcon,
                  styles.passwordInput,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, color: theme.text },
                ]}
                placeholder={t('authPasswordPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable style={styles.passwordToggle} onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <ThemedText type="small" themeColor="textSecondary">
                  {showPassword ? t('authHidePassword') : t('authShowPassword')}
                </ThemedText>
              </Pressable>
            </View>
          )}

          {mode === 'signIn' && (
            <View style={styles.optionsRow}>
              <View style={styles.rememberMe}>
                <Checkbox checked={rememberMe} onToggle={() => setRememberMe((v) => !v)} />
                <Pressable onPress={() => setRememberMe((v) => !v)} hitSlop={8}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('authRememberMe')}
                  </ThemedText>
                </Pressable>
              </View>

              <Pressable onPress={() => setMode('forgotPassword')} hitSlop={8}>
                <ThemedText type="small" themeColor="accent">
                  {t('authForgotPassword')}
                </ThemedText>
              </Pressable>
            </View>
          )}

          <Pressable
            style={[styles.submit, { backgroundColor: theme.accent, opacity: loading ? 0.6 : 1 }]}
            disabled={loading}
            onPress={handleSubmit}>
            {loading ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText type="smallBold" themeColor="background">
                {mode === 'signUp' ? t('authCreateAccountButton') : mode === 'forgotPassword' ? t('authSendResetLink') : t('authLogIn')}
              </ThemedText>
            )}
          </Pressable>

          {mode === 'signUp' && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.agreementText}>
              {t('authAgreementPrefix')}{' '}
              <ThemedText type="small" themeColor="accent" onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
                {t('authAgreementPrivacyPolicy')}
              </ThemedText>{' '}
              {t('authAgreementJoiner')}{' '}
              <ThemedText type="small" themeColor="accent" onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}>
                {t('authAgreementTermsOfService')}
              </ThemedText>
              .
            </ThemedText>
          )}

          {mode === 'forgotPassword' && (
            <Pressable onPress={() => setMode('signIn')} hitSlop={8}>
              <ThemedText type="linkPrimary" style={styles.switchModeText}>
                {t('authBackToSignIn')}
              </ThemedText>
            </Pressable>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four },
  // No max width meant this stretched edge-to-edge on a wide (web) viewport
  // — a plain phone-width card, capped and centered, regardless of screen
  // size, is far more compact and reads as a proper form rather than a
  // full-bleed page.
  form: {
    alignItems: 'center',
    gap: Spacing.four,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 460,
    borderWidth: 1,
    borderRadius: Spacing.four,
    padding: Spacing.five,
  },
  badge: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  badgeIcon: { width: 38, height: 38 },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: Spacing.two, alignSelf: 'stretch' },
  subtitleLink: { fontSize: 14, lineHeight: 20 },
  input: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 28, paddingVertical: Spacing.three + Spacing.half, paddingHorizontal: Spacing.four },
  inputWrapper: { alignSelf: 'stretch', justifyContent: 'center' },
  inputIcon: { position: 'absolute', left: Spacing.four, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 },
  inputWithIcon: { paddingLeft: Spacing.four + 18 + Spacing.two },
  passwordWrapper: { alignSelf: 'stretch', justifyContent: 'center' },
  passwordInput: { paddingRight: Spacing.four + Spacing.three },
  passwordToggle: { position: 'absolute', right: Spacing.three, paddingVertical: Spacing.two, paddingHorizontal: Spacing.one },
  optionsRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -Spacing.two,
  },
  rememberMe: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  submit: {
    alignSelf: 'center',
    alignItems: 'center',
    minWidth: 180,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.six,
    borderRadius: 999,
    marginTop: Spacing.two,
  },
  switchModeText: { textAlign: 'center', marginTop: Spacing.one },
  agreementText: { textAlign: 'center', marginTop: -Spacing.two },
});
