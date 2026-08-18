import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { Checkbox } from '@/components/checkbox';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';
import { SUPABASE_AUTH_STORAGE_KEY, getAuthCallbackUrl, supabase } from '@/lib/supabase';

type Mode = 'signIn' | 'signUp' | 'forgotPassword';

const COPY: Record<Mode, { title: string; subtitle?: string }> = {
  signIn: { title: 'Welcome home' },
  signUp: { title: 'Create your account' },
  forgotPassword: { title: 'Reset your password', subtitle: "We'll email you a link to get back in." },
};

export function AuthScreen() {
  const theme = useTheme();
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
        showAlert('Enter your email');
        return;
      }
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: getAuthCallbackUrl(),
      });
      setLoading(false);
      if (error) {
        showAlert("Couldn't send reset email", error.message);
      } else {
        showAlert('Check your email', `We've sent a password reset link to ${email.trim()}.`);
        setMode('signIn');
      }
      return;
    }

    if (!email.trim() || !password) {
      showAlert('Enter your email and password');
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
      if (error) showAlert('Sign up error', error.message);
      else showAlert('Account created', 'Check your email if confirmation is required, otherwise just sign in.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (!error && !rememberMe) {
        // "Remember me" off: this session stays active until the app fully
        // restarts, but strip the just-persisted copy so a future cold
        // start won't restore it and requires signing in again.
        await AsyncStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
      }
      setLoading(false);
      if (error) showAlert('Sign in error', error.message);
    }
  }

  const copy = COPY[mode];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.form}
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
              {mode === 'signUp' ? 'Already have an account? ' : "Don't have an account? "}
              <ThemedText
                type="linkPrimary"
                style={styles.subtitleLink}
                onPress={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}>
                {mode === 'signUp' ? 'Sign in' : 'Sign up now'}
              </ThemedText>
            </ThemedText>
          )}

          {mode === 'signUp' && (
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, color: theme.text },
              ]}
              placeholder="Name"
              placeholderTextColor={theme.textSecondary}
              value={fullName}
              onChangeText={setFullName}
            />
          )}

          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, color: theme.text },
            ]}
            placeholder="Email address"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          {mode !== 'forgotPassword' && (
            <View style={styles.passwordWrapper}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, color: theme.text },
                ]}
                placeholder="Password"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable style={styles.passwordToggle} onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <ThemedText type="small" themeColor="textSecondary">
                  {showPassword ? 'Hide' : 'Show'}
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
                    Remember me
                  </ThemedText>
                </Pressable>
              </View>

              <Pressable onPress={() => setMode('forgotPassword')} hitSlop={8}>
                <ThemedText type="small" themeColor="accent">
                  Forgot password?
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
                {mode === 'signUp' ? 'Create account' : mode === 'forgotPassword' ? 'Send reset link' : 'Log in'}
              </ThemedText>
            )}
          </Pressable>

          {mode === 'forgotPassword' && (
            <Pressable onPress={() => setMode('signIn')} hitSlop={8}>
              <ThemedText type="linkPrimary" style={styles.switchModeText}>
                Back to sign in
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
  form: { alignItems: 'center', gap: Spacing.three },
  badge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  badgeIcon: { width: 32, height: 32 },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: Spacing.two, alignSelf: 'stretch' },
  subtitleLink: { fontSize: 14, lineHeight: 20 },
  input: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 28, padding: Spacing.three },
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
});
