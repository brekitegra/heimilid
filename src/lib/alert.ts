import { Alert, Platform } from 'react-native';

export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type AlertState = { title: string; message?: string; buttons: AlertButton[] };

let listener: ((state: AlertState | null) => void) | null = null;

/** Set by AlertHost (mounted once near the app root) so showAlert can
 * push a themed dialog onto the screen despite being a plain importable
 * function rather than a hook — every one of this app's ~19 call-site
 * files stays completely untouched by this. */
export function setAlertListener(fn: ((state: AlertState | null) => void) | null) {
  listener = fn;
}

/** `Alert.alert` is a documented no-op on web in react-native-web, so
 * every error message and confirmation dialog in this app was invisible
 * when running on web. Native is unaffected — `Alert.alert` already
 * renders the OS's own themed dialog there, exactly as before.
 *
 * On web this used to fall back to the browser's raw `window.alert`/
 * `window.confirm` — functional, but a jarring "localhost:8081 says"
 * box with none of the app's own styling. It now routes through
 * AlertHost (src/components/alert-host.tsx) instead, which renders a
 * dialog matching the rest of the app. */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const resolvedButtons: AlertButton[] = buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }];

  if (listener) {
    listener({ title, message, buttons: resolvedButtons });
  } else {
    // AlertHost hasn't mounted yet — shouldn't happen in practice, but
    // fall back to the native browser dialog rather than silently
    // dropping the message.
    window.alert(message ? `${title}\n\n${message}` : title);
    resolvedButtons.find((b) => b.style !== 'cancel')?.onPress?.();
  }
}
