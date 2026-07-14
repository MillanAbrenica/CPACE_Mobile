/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

/**
 * CPACE brand palette — mirrored from the Laravel web app's design tokens
 * (resources/views/student/dashboard.blade.php :root variables).
 * Maroon primary (#7B1D1D), brick accent (#c0392b), Poppins typography.
 */
export const CPACE = {
  primary: '#7B1D1D',
  primaryHover: '#6a1818',
  primaryLight: '#f5e8e8',
  primaryMid: '#9b2b2b',
  accent: '#c0392b',
  // maroon gradient used by the mobile app header in the web build
  headerGradient: ['#6b1515', '#9b2b2b', '#c0392b'] as const,

  white: '#ffffff',
  screenBg: '#f4f5f7',
  card: '#ffffff',

  gray100: '#f8f9fa',
  gray200: '#f0f0f0',
  gray300: '#e0e0e0',
  gray400: '#cccccc',
  gray500: '#999999',
  gray700: '#555555',
  gray900: '#333333',
  border: '#eeeeee',
  divider: '#f5f5f5',

  green: '#10b981',
  blue: '#3b82f6',
  orange: '#f59e0b',
  purple: '#8e44ad',
  danger: '#e53e3e',

  greenBg: '#d1fae5',
  blueBg: '#dbeafe',
  orangeBg: '#fef3c7',
  redBg: '#fde8e8',
  purpleBg: '#ede0f3',
};

export const Radius = { sm: 8, md: 12, lg: 14, xl: 16, pill: 999 };
export const Spacing = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 };

/** Poppins font family names (registered in the root layout via @expo-google-fonts/poppins). */
export const Font = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
};

const tintColorLight = '#7B1D1D';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

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
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
