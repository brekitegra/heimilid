import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useHousehold } from '@/hooks/use-household';
import { useTheme } from '@/hooks/use-theme';

type Mode = 'create' | 'join';

export function HouseholdOnboarding() {
  const theme = useTheme();
  const { createHousehold, joinHousehold } = useHousehold();
  const [mode, setMode] = useState<Mode>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (mode === 'create' && !name.trim()) {
      Alert.alert('Give your household a name');
      return;
    }
    if (mode === 'join' && !code.trim()) {
      Alert.alert('Enter an invite code');
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
      Alert.alert(
        mode === 'create' ? "Couldn't create household" : "Couldn't join household",
        err instanceof Error ? err.message : 'Something went wrong'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Heimilið
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          Create a household to get started, or join one with an invite code.
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.tabs}>
          <Pressable
            style={[styles.tab, mode === 'create' && { backgroundColor: theme.backgroundSelected }]}
            onPress={() => setMode('create')}>
            <ThemedText type="smallBold">Create</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.tab, mode === 'join' && { backgroundColor: theme.backgroundSelected }]}
            onPress={() => setMode('join')}>
            <ThemedText type="smallBold">Join</ThemedText>
          </Pressable>
        </ThemedView>

        {mode === 'create' ? (
          <TextInput
            style={[styles.input, { borderColor: theme.backgroundSelected, color: theme.text }]}
            placeholder="e.g. Gylfason family"
            placeholderTextColor={theme.textSecondary}
            value={name}
            onChangeText={setName}
          />
        ) : (
          <TextInput
            style={[styles.input, { borderColor: theme.backgroundSelected, color: theme.text }]}
            placeholder="Invite code"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="characters"
            value={code}
            onChangeText={setCode}
          />
        )}

        <Pressable
          style={[styles.submit, { backgroundColor: theme.text, opacity: submitting ? 0.6 : 1 }]}
          disabled={submitting}
          onPress={handleSubmit}>
          {submitting ? (
            <ActivityIndicator color={theme.background} />
          ) : (
            <ThemedText type="smallBold" themeColor="background">
              {mode === 'create' ? 'Create household' : 'Join household'}
            </ThemedText>
          )}
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
  tabs: { flexDirection: 'row', borderRadius: Spacing.three, padding: Spacing.half },
  tab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Spacing.two },
  input: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three },
  submit: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Spacing.two, marginTop: Spacing.two },
});
