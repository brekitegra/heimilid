import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { setAlertListener, type AlertButton, type AlertState } from '@/lib/alert';

/** Renders showAlert()'s web dialog — see the doc comment on showAlert
 * (src/lib/alert.ts) for why this indirection exists. Mount once near
 * the app root. Native is a no-op here: Alert.alert already renders the
 * OS's own dialog there, so this component never subscribes or draws
 * anything on native. */
export function AlertHost() {
  const theme = useTheme();
  const [state, setState] = useState<AlertState | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    setAlertListener(setState);
    return () => setAlertListener(null);
  }, []);

  if (Platform.OS !== 'web' || !state) return null;

  function dismiss() {
    setState(null);
  }

  function handlePress(button: AlertButton) {
    setState(null);
    button.onPress?.();
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.backgroundSelected, borderWidth: 1 }]}>
          <ThemedText style={styles.title}>{state.title}</ThemedText>
          {state.message ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
              {state.message}
            </ThemedText>
          ) : null}
          <View style={styles.buttonRow}>
            {state.buttons.map((button, index) => {
              const isDestructive = button.style === 'destructive';
              const isCancel = button.style === 'cancel';
              return (
                <Pressable key={index} onPress={() => handlePress(button)} style={styles.buttonWrapper}>
                  <ThemedView
                    type={isCancel ? 'background' : undefined}
                    style={[
                      styles.button,
                      isDestructive && styles.destructiveButton,
                      !isCancel && !isDestructive && { backgroundColor: theme.accent },
                    ]}>
                    <ThemedText
                      type="smallBold"
                      themeColor={isCancel ? 'textSecondary' : isDestructive ? undefined : 'background'}
                      style={isDestructive && styles.destructiveText}>
                      {button.text}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              );
            })}
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(20,14,8,0.4)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  title: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  message: { lineHeight: 20 },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  buttonWrapper: { flexShrink: 1 },
  button: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 999,
    alignItems: 'center',
  },
  destructiveButton: { backgroundColor: '#e5484d' },
  destructiveText: { color: '#ffffff' },
});
