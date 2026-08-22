import { Linking, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/constants/legal';
import { Spacing } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-language';

/** The Privacy Policy / Terms of Service row — shown wherever a store
 * reviewer (or a curious user) would reasonably look for it: the quick
 * menu, Profile, and the sign-up screen. `Linking.openURL` opens the
 * system browser on native and a new tab on web, so this never needs to
 * leave a WebView or a Safari view controller stuck inside the app. */
export function LegalLinks() {
  const t = useTranslation();

  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="accent" onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
        {t('privacyPolicy')}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        ·
      </ThemedText>
      <ThemedText type="small" themeColor="accent" onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}>
        {t('termsOfService')}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
