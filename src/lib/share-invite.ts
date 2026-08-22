import { Platform, Share } from 'react-native';

import { showAlert } from '@/lib/alert';
import type { Household } from '@/types/household';
import type { Language } from '@/hooks/use-language';

/** Opens the platform share sheet with the household's invite code. Shared
 * between the Household tab and the Profile screen so both stay in sync.
 * Plain function, no hook access — see chore-format.ts's doc comment —
 * so it takes `language` directly rather than going through t(). */
export async function shareHouseholdInvite(household: Household, language: Language = 'en') {
  const message =
    language === 'is'
      ? `Vertu með í heimilinu okkar „${household.name}" á Home appinu! Notaðu boðskóða: ${household.invite_code}`
      : `Join our household "${household.name}" on Home! Use invite code: ${household.invite_code}`;

  try {
    await Share.share({ message });
  } catch (err) {
    // react-native-web's Share.share unconditionally rejects with "Share
    // is not supported in this browser" whenever navigator.share is
    // undefined — true of most desktop browsers (Web Share is mainly a
    // mobile-web feature), which is exactly where this app is mostly
    // used/tested. Without this fallback, tapping "Share invite" here
    // would silently do nothing at all on desktop web. Fall back to
    // copying the invite message to the clipboard instead, with real
    // user-visible confirmation — native keeps its original (unchanged)
    // behavior of surfacing a genuine Share failure.
    if (Platform.OS === 'web' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(message);
        showAlert(
          language === 'is' ? 'Afritað á klippiborð' : 'Copied to clipboard',
          language === 'is'
            ? 'Boðið hefur verið afritað — settu það inn hvar sem er til að deila því.'
            : 'The invite message has been copied — paste it anywhere to share it.'
        );
        return;
      } catch {
        // Clipboard API also unavailable (e.g. an insecure context) —
        // fall through to surfacing the original Share error below.
      }
    }
    throw err;
  }
}
