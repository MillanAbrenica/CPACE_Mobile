import { Card, Screen, T, initialsOf } from '@/components/cpace-ui';
import { CPACE, Radius } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { FontAwesome6 } from '@expo/vector-icons';
import { ReactNode, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [sound, setSound] = useState(false);

  const confirmLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account */}
        <Card style={styles.account}>
          <View style={styles.avatar}>
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
          </View>
          <FontAwesome6 name="pen" size={14} color={CPACE.primary} />
        </Card>

        <Section title="Notifications">
          <Row icon="bell" tint={CPACE.accent} bg={CPACE.redBg} label="Push notifications" right={<Switch value={notifications} onValueChange={setNotifications} trackColor={{ true: CPACE.primary }} />} />
          <Row icon="clock" tint={CPACE.blue} bg={CPACE.blueBg} label="Study reminders" right={<Switch value={reminders} onValueChange={setReminders} trackColor={{ true: CPACE.primary }} />} />
          <Row icon="volume-high" tint={CPACE.green} bg={CPACE.greenBg} label="Sound effects" right={<Switch value={sound} onValueChange={setSound} trackColor={{ true: CPACE.primary }} />} last />
        </Section>

        <Section title="Study">
          <Row icon="calendar-day" tint={CPACE.orange} bg={CPACE.orangeBg} label="Target exam date" value={user?.examDate ?? 'Not set'} chevron />
          <Row icon="bullseye" tint={CPACE.primary} bg={CPACE.primaryLight} label="Daily question goal" value="20 questions" chevron last />
        </Section>

        <Section title="About">
          <Row icon="circle-info" tint={CPACE.gray700} bg={CPACE.gray200} label="App version" value="1.0.0" />
          <Row icon="shield-halved" tint={CPACE.gray700} bg={CPACE.gray200} label="Privacy policy" chevron />
          <Row icon="circle-question" tint={CPACE.gray700} bg={CPACE.gray200} label="Help & support" chevron last />
        </Section>

        <Pressable style={styles.logout} onPress={confirmLogout}>
          <FontAwesome6 name="right-from-bracket" size={16} color={CPACE.danger} />
          <T weight="semibold" size={14} color={CPACE.danger}>
            Log out
          </T>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      <T weight="semibold" size={12} color={CPACE.gray500} style={{ marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </T>
      <Card style={{ padding: 0 }}>{children}</Card>
    </View>
  );
}

function Row({
  icon,
  tint,
  bg,
  label,
  value,
  right,
  chevron,
  last,
}: {
  icon: string;
  tint: string;
  bg: string;
  label: string;
  value?: string;
  right?: ReactNode;
  chevron?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={[styles.rowIcon, { backgroundColor: bg }]}>
        <FontAwesome6 name={icon as any} size={14} color={tint} />
      </View>
      <T size={14} style={{ flex: 1 }}>
        {label}
      </T>
      {value ? (
        <T size={13} color={CPACE.gray500}>
          {value}
        </T>
      ) : null}
      {right}
      {chevron ? <FontAwesome6 name="chevron-right" size={12} color={CPACE.gray400} style={{ marginLeft: 8 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 28 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: CPACE.primary, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: CPACE.divider },
  rowIcon: { width: 34, height: 34, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  logout: {
    marginTop: 24,
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
