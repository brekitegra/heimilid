import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemePreference } from '@/hooks/use-theme-preference';

/** The color scheme actually in effect — the person's explicit Light/Dark
 * override if they set one, otherwise whatever the OS reports. Every
 * theme-sensitive spot (useTheme, the tab bars, the root layout's
 * navigation theme) should read this instead of the OS scheme directly,
 * so an override applies everywhere consistently. */
export function useResolvedColorScheme(): 'light' | 'dark' {
  const systemScheme = useColorScheme();
  const { preference } = useThemePreference();
  if (preference !== 'system') return preference;
  return systemScheme === 'dark' ? 'dark' : 'light';
}
