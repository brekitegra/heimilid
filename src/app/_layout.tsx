import type { Session } from '@supabase/supabase-js';
import { DarkTheme, DefaultTheme, Slot, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { AlertHost } from '@/components/alert-host';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthScreen } from '@/components/auth-screen';
import { HouseDoorIntro } from '@/components/house-door-intro';
import { HouseholdGate } from '@/components/household-gate';
import { LanguageProvider } from '@/hooks/use-language';
import { useResolvedColorScheme } from '@/hooks/use-resolved-color-scheme';
import { ThemePreferenceProvider } from '@/hooks/use-theme-preference';
import { supabase } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [checkedSession, setCheckedSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCheckedSession(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!checkedSession) return null;

  // The resolved-scheme hook needs to sit under the preference provider,
  // so the actual layout content lives in a child component.
  return (
    <LanguageProvider>
      <ThemePreferenceProvider>
        <RootContent session={session} pathname={pathname} />
      </ThemePreferenceProvider>
    </LanguageProvider>
  );
}

function RootContent({ session, pathname }: { session: Session | null; pathname: string }) {
  const colorScheme = useResolvedColorScheme();

  // The rest of this layout replaces the routed tree entirely with either
  // the auth screens or the household app based on session state, rather
  // than rendering a <Slot/> — so a plain routed screen would never
  // actually show. auth-callback is a real, always-reachable route
  // (it's where email confirmation/password-reset links land, regardless
  // of whether a session already exists), so it's the one path that opts
  // back into normal Expo Router rendering.
  if (pathname === '/auth-callback') {
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <AlertHost />
        <Slot />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AlertHost />
      {session ? (
        <HouseholdGate session={session} />
      ) : (
        <>
          <AuthScreen />
          <HouseDoorIntro />
        </>
      )}
    </ThemeProvider>
  );
}