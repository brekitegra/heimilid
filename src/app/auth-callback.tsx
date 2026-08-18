import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';
import { supabase } from '@/lib/supabase';

type Status = 'working' | 'setPassword' | 'emailChanged' | 'error';

/** Hands off from this screen back into the app. On web this is a full
 * reload rather than `router.replace` — `_layout.tsx` renders an entirely
 * different tree depending on the route (this screen vs. the household
 * app), and replacing in place races Expo Router's own <Slot/> reconciling
 * to the new route before _layout re-renders into the properly-wrapped
 * tree, which briefly mounts index.tsx outside of HouseholdProvider and
 * crashes. A hard reload sidesteps that entirely by starting fresh.
 * Native doesn't have an equivalent "reload the page" concept, so it uses
 * router.replace — unverified here (no device/simulator available), but
 * native's stack navigation may not share the same race. */
function goHome() {
  if (Platform.OS === 'web') {
    window.location.href = '/';
  } else {
    router.replace('/');
  }
}

/** Pulls Supabase's implicit-flow auth params out of a URL's hash fragment
 * (or query string, in case a future flow ever puts them there instead). */
function parseAuthParams(url: string) {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const raw = hashIndex >= 0 ? url.slice(hashIndex + 1) : queryIndex >= 0 ? url.slice(queryIndex + 1) : '';
  const params = new URLSearchParams(raw);
  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    type: params.get('type'),
    errorDescription: params.get('error_description'),
  };
}

/** Where email confirmation and password-reset links land. Establishes the
 * session carried in the link, then either lets normal session-based
 * routing take over (signup confirmation) or asks for a new password
 * (password recovery). */
export default function AuthCallbackScreen() {
  const theme = useTheme();
  const nativeUrl = Linking.useURL();
  const [status, setStatus] = useState<Status>('working');
  const [errorMessage, setErrorMessage] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Parses the one-time link this screen was opened from and reacts to it —
  // an external event this effect is subscribing to, not React state being
  // synchronized.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const url = Platform.OS === 'web' ? window.location.href : nativeUrl;
    if (!url) return;

    const { accessToken, refreshToken, type, errorDescription } = parseAuthParams(url);

    if (errorDescription) {
      setErrorMessage(errorDescription);
      setStatus('error');
      return;
    }
    if (!accessToken || !refreshToken) {
      setErrorMessage('This link is missing or has already been used.');
      setStatus('error');
      return;
    }

    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      if (error) {
        setErrorMessage(error.message);
        setStatus('error');
      } else if (type === 'recovery') {
        setStatus('setPassword');
      } else if (type === 'email_change') {
        // Shown once — doesn't need to react to any further state, so no
        // auto-redirect timer; the person taps through when ready.
        setStatus('emailChanged');
      } else {
        // Signup confirmation (or any other implicit-flow link): the user
        // is now signed in — hand off to the normal session-based routing
        // in _layout.tsx.
        goHome();
      }
    });
  }, [nativeUrl]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleSetPassword() {
    if (password.length < 6) {
      showAlert('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      showAlert("Passwords don't match");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      showAlert("Couldn't update password", error.message);
      return;
    }
    showAlert('Password updated', "You're signed in with your new password.");
    goHome();
  }

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

          {status === 'working' && (
            <>
              <ThemedText type="subtitle" style={styles.title}>
                One moment…
              </ThemedText>
              <ActivityIndicator color={theme.accent} style={styles.spinner} />
            </>
          )}

          {status === 'setPassword' && (
            <>
              <ThemedText type="subtitle" style={styles.title}>
                Set a new password
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                Choose a new password for your account.
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, color: theme.text },
                ]}
                placeholder="New password"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, color: theme.text },
                ]}
                placeholder="Confirm new password"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <Pressable
                style={[styles.submit, { backgroundColor: theme.accent, opacity: submitting ? 0.6 : 1 }]}
                disabled={submitting}
                onPress={handleSetPassword}>
                {submitting ? (
                  <ActivityIndicator color={theme.background} />
                ) : (
                  <ThemedText type="smallBold" themeColor="background">
                    Update password
                  </ThemedText>
                )}
              </Pressable>
            </>
          )}

          {status === 'emailChanged' && (
            <>
              <ThemedText type="subtitle" style={styles.title}>
                Email updated
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                Your account&apos;s email address has been changed.
              </ThemedText>
              <Pressable style={[styles.submit, { backgroundColor: theme.accent }]} onPress={goHome}>
                <ThemedText type="smallBold" themeColor="background">
                  Continue
                </ThemedText>
              </Pressable>
            </>
          )}

          {status === 'error' && (
            <>
              <ThemedText type="subtitle" style={styles.title}>
                Link expired
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                {errorMessage || 'This link is no longer valid. Request a new one from the sign-in screen.'}
              </ThemedText>
              <Pressable style={[styles.submit, { backgroundColor: theme.accent }]} onPress={goHome}>
                <ThemedText type="smallBold" themeColor="background">
                  Back to sign in
                </ThemedText>
              </Pressable>
            </>
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
  spinner: { marginTop: Spacing.two },
  input: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 28, padding: Spacing.three },
  submit: {
    alignSelf: 'center',
    alignItems: 'center',
    minWidth: 180,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.six,
    borderRadius: 999,
    marginTop: Spacing.two,
  },
});
