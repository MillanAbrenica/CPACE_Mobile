// Shared CPACE UI primitives used across all student screens.
// Keeps every screen consistent with the web app's maroon/Poppins design.

import { CPACE, Font, Radius } from '@/constants/theme';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Themed text with Poppins applied by weight. */
export function T({
  weight = 'regular',
  size = 14,
  color = CPACE.gray900,
  style,
  ...rest
}: TextProps & { weight?: keyof typeof Font; size?: number; color?: string }) {
  return (
    <Text {...rest} style={[{ fontFamily: Font[weight], fontSize: size, color }, style]} />
  );
}

/** Plain white rounded card. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Section header row: title on the left, optional link/action on the right. */
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <T weight="semibold" size={15}>
        {title}
      </T>
      {action}
    </View>
  );
}

/** Small colored chip (subject code, status, etc.). */
export function Pill({
  label,
  color = CPACE.primary,
  bg = CPACE.primaryLight,
}: {
  label: string;
  color?: string;
  bg?: string;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <T weight="semibold" size={11} color={color}>
        {label}
      </T>
    </View>
  );
}

/** Rounded icon tile (FontAwesome6). */
export function IconTile({
  name,
  color = CPACE.primary,
  bg = CPACE.primaryLight,
  size = 16,
  tile = 38,
}: {
  name: any;
  color?: string;
  bg?: string;
  size?: number;
  tile?: number;
}) {
  return (
    <View style={{ width: tile, height: tile, borderRadius: Radius.sm, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <FontAwesome6 name={name} size={size} color={color} />
    </View>
  );
}

/** Horizontal progress bar. */
export function ProgressBar({ value, color = CPACE.primary, track = '#f0c9c9', height = 8 }: { value: number; color?: string; track?: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${Math.min(100, Math.max(0, value))}%`, height: '100%', backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

/** Maroon gradient app header (greeting / title + optional right slot). */
export function AppHeader({
  title,
  subtitle,
  initials,
  right,
}: {
  title: string;
  subtitle?: string;
  initials?: string;
  right?: ReactNode;
}) {
  return (
    <LinearGradient colors={CPACE.headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
      <SafeAreaView edges={['top']} style={styles.headerInner}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            {initials ? (
              <View style={styles.avatar}>
                <T weight="bold" size={14} color="#fff">
                  {initials}
                </T>
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <T weight="semibold" size={17} color="#fff" numberOfLines={1}>
                {title}
              </T>
              {subtitle ? (
                <T size={12} color="rgba(255,255,255,0.7)" numberOfLines={1}>
                  {subtitle}
                </T>
              ) : null}
            </View>
          </View>
          {right}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

/** Screen scaffold with the standard grey background. */
export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Loader() {
  return (
    <View style={styles.loader}>
      <ActivityIndicator color={CPACE.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CPACE.screenBg },
  card: {
    backgroundColor: CPACE.card,
    borderRadius: Radius.lg,
    padding: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, alignSelf: 'flex-start' },
  header: { paddingBottom: 16 },
  headerInner: { paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 6 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: CPACE.screenBg },
});

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}
