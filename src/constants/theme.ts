/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// A warm, "homey" palette — linen/clay/espresso rather than stark
// black-and-white — with one accent color (a terracotta clay) used
// sparingly for primary actions and links.
export const Colors = {
  light: {
    text: '#2B2118',
    background: '#FBF7F0',
    backgroundElement: '#F1E7D8',
    backgroundSelected: '#E7D8C0',
    // Darkened from #7C6F5E — that shade only passed WCAG AA (4.5:1)
    // against the plain page background; against backgroundElement (where
    // most meta captions actually sit, inside filled card rows) it was
    // 4.0:1, failing AA. This passes comfortably against both.
    textSecondary: '#6B5D4C',
    accent: '#C1633D',
  },
  dark: {
    text: '#F5EAD9',
    background: '#1C1712',
    backgroundElement: '#2A2119',
    backgroundSelected: '#3B2E22',
    textSecondary: '#B3A28C',
    accent: '#E0824B',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
