import { AppHeader, Card, IconTile, Screen, T, initialsOf } from '@/components/cpace-ui';
import { CPACE, Radius } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { FontAwesome6 } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

const ITEMS: { label: string; icon: string; tint: string; bg: string; href: Href }[] = [
  { label: 'Quiz History', icon: 'clock-rotate-left', tint: CPACE.accent, bg: CPACE.redBg, href: '/quiz-history' },
  { label: 'Performance', icon: 'chart-simple', tint: CPACE.blue, bg: CPACE.blueBg, href: '/performance' },
  { label: 'Review Notes', icon: 'note-sticky', tint: CPACE.orange, bg: CPACE.orangeBg, href: '/review-notes' },
  { label: 'Calendar', icon: 'calendar-days', tint: CPACE.green, bg: CPACE.greenBg, href: '/calendar' },
  { label: 'Achievements', icon: 'trophy', tint: CPACE.purple, bg: CPACE.purpleBg, href: '/achievements' },
  { label: 'Settings', icon: 'gear', tint: CPACE.gray700, bg: CPACE.gray200, href: '/settings' },
];

export default function MoreScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const confirmLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <Screen>
      <AppHeader title="More" subtitle="Tools & account" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <Card style={styles.profile}>
          <View style={styles.profileAvatar}>
            <T weight="bold" size={20} color="#fff">
              {initialsOf(user?.name ?? 'S')}
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <T weight="semibold" size={16}>
              {user?.name}
            </T>
            <T size={12} color={CPACE.gray500}>
              {user?.email}
            </T>
            <View style={styles.roleTag}>
              <T weight="semibold" size={10} color={CPACE.primary}>
                STUDENT
              </T>
            </View>
          </View>
        </Card>

        {/* Grid */}
        <View style={styles.grid}>
          {ITEMS.map((it) => (
            <Pressable key={it.label} style={styles.tile} onPress={() => router.push(it.href)}>
              <IconTile name={it.icon} color={it.tint} bg={it.bg} tile={52} size={20} />
              <T weight="medium" size={12} style={{ marginTop: 8, textAlign: 'center' }}>
                {it.label}
              </T>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.logout} onPress={confirmLogout}>
          <FontAwesome6 name="right-from-bracket" size={16} color={CPACE.danger} />
          <T weight="semibold" size={14} color={CPACE.danger}>
            Log out
          </T>
        </Pressable>

        <T size={11} color={CPACE.gray400} style={{ textAlign: 'center', marginTop: 18 }}>
          CPACE Mobile · v1.0.0
        </T>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 28 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: CPACE.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleTag: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    backgroundColor: CPACE.primaryLight,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '31.5%',
    flexGrow: 1,
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    paddingVertical: 18,
    alignItems: 'center',
  },
  logout: {
    marginTop: 18,
    height: 50,
    borderRadius: Radius.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3d4d4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
});
