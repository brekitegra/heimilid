import { Alert, Platform } from 'react-native';

type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

/** `Alert.alert` is a documented no-op on web in react-native-web — it
 * silently does nothing there, so every error message and confirmation
 * dialog in this app was invisible when running on web. This wraps it:
 * native behaves exactly as before, web falls back to the browser's own
 * `alert`/`confirm`. Not themed, but it actually shows up. */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  const proceed = window.confirm(text);
  const proceedButton = buttons.find((b) => b.style !== 'cancel');
  const cancelButton = buttons.find((b) => b.style === 'cancel');
  (proceed ? proceedButton : cancelButton)?.onPress?.();
}
