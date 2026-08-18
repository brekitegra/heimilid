import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type Mode = 'signIn' | 'signUp';

export function AuthScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('signIn');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password) {
      Alert.alert('Enter your email and password');
      return;
    }

    setLoading(true);
    if (mode === 'signUp') {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() || undefined } },
      });
      setLoading(false);
      if (error) Alert.alert('Sign up error', error.message);
      else Alert.alert('Account created', 'Check your email if confirmation is required, otherwise just sign in.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setLoading(false);
      if (error) Alert.alert('Sign in error', error.message);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Heimilið
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          Chores, pets, finances, and the kids&apos; schedules — all in one home.
        </ThemedText>

        {mode === 'signUp' && (
          <TextInput
            style={[styles.input, { borderColor: theme.backgroundSelected, color: theme.text }]}
            placeholder="Name"
            placeholderTextColor={theme.textSecondary}
            value={fullName}
            onChangeText={setFullName}
          />
        )}
        <TextInput
          style={[styles.input, { borderColor: theme.backgroundSelected, color: theme.text }]}
          placeholder="Email"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={[styles.input, { borderColor: theme.backgroundSelected, color: theme.text }]}
          placeholder="Password"
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Pressable
          style={[styles.submit, { backgroundColor: theme.text, opacity: loading ? 0.6 : 1 }]}
          disabled={loading}
          onPress={handleSubmit}>
          {loading ? (
            <ActivityIndicator color={theme.background} />
          ) : (
            <ThemedText type="smallBold" themeColor="background">
              {mode === 'signUp' ? 'Create account' : 'Sign in'}
            </ThemedText>
          )}
        </Pressable>

        <Pressable onPress={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}>
          <ThemedText type="linkPrimary" style={styles.switchModeText}>
            {mode === 'signUp' ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four, gap: Spacing.three },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: Spacing.two },
  input: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three },
  submit: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Spacing.two, marginTop: Spacing.two },
  switchModeText: { textAlign: 'center', marginTop: Spacing.two },
});
