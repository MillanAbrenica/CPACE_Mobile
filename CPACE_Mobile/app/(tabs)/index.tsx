import { AppHeader, Card, IconTile, Loader, ProgressBar, Screen, SectionHeader, T, initialsOf } from '@/components/cpace-ui';
import { CPACE, Radius } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ACTIVITY_LABELS, firstName, greeting, timeAgo } from '@/lib/format';
import type { DashboardSummary } from '@/lib/types';
import { FontAwesome6 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => setData(await api.getDashboard());
  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <Screen>
      <AppHeader
        title={`${greeting()}, ${firstName(user?.name ?? 'Student')}!`}
        subtitle="Welcome back"
        initials={initialsOf(user?.name ?? 'S')}
        right={
          <Pressable style={styles.bell}>
            <FontAwesome6 name="bell" size={16} color="#fff" />
            {data && data.unreadNotifications > 0 ? (
              <View style={styles.badge}>
                <T weight="bold" size={9} color="#fff">
                  {data.unreadNotifications}
                </T>
              </View>
            ) : null}
          </Pressable>
        }
      />

      {!data ? (
        <Loader />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CPACE.primary} />}
        >
          {/* Exam countdown banner */}
          <View style={styles.banner}>
            <T weight="bold" size={18} color={CPACE.gray900}>
              Keep going, {firstName(user?.name ?? 'Student')}! 👋
            </T>
            <T size={12} color={CPACE.gray700} style={{ marginTop: 4 }}>
              Every day you study brings you closer to your goal.
            </T>
            <View style={styles.countdown}>
              <FontAwesome6 name="fire-flame-curved" size={13} color={CPACE.accent} />
              <T weight="semibold" size={13} color={CPACE.accent}>
                {data.daysToExam !== null ? `${data.daysToExam} days until board exam` : 'Set your exam target date'}
              </T>
            </View>
          </View>

          {/* Metrics 2x2 */}
          <View style={styles.metricsGrid}>
            <Metric icon="chart-area" tint={CPACE.accent} bg={CPACE.redBg} label="Board Readiness" value={`${data.readiness}%`} sub="Overall accuracy" />
            <Metric icon="clipboard-check" tint={CPACE.green} bg={CPACE.greenBg} label="Questions" value={data.questionsAttempted.toLocaleString()} sub={`+${data.questionsThisWeek} this week`} />
            <Metric icon="clock" tint={CPACE.blue} bg={CPACE.blueBg} label="Study Time" value={`${data.studyHours}h`} sub={`+${data.studyHoursWeek}h this week`} />
            <Metric icon="fire" tint={CPACE.orange} bg={CPACE.orangeBg} label="Day Streak" value={`${data.streak}`} sub={data.streak > 0 ? 'Keep it up!' : 'Start today'} />
          </View>

          {/* Quick actions */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 18 }}>
            <Pressable style={[styles.action, styles.actionPrimary]} onPress={() => router.push('/(tabs)/quizzes')}>
              <FontAwesome6 name="bolt" size={14} color="#fff" />
              <T weight="semibold" size={13} color="#fff">
                Quick Quiz
              </T>
            </Pressable>
            <Pressable style={[styles.action, styles.actionOutline]} onPress={() => router.push('/calendar')}>
              <FontAwesome6 name="calendar-days" size={14} color={CPACE.primary} />
              <T weight="semibold" size={13} color={CPACE.primary}>
                Calendar
              </T>
            </Pressable>
          </View>

          {/* Subject mastery */}
          <Card style={{ marginBottom: 16 }}>
            <SectionHeader
              title="Subject Mastery"
              action={
                <Pressable onPress={() => router.push('/(tabs)/subjects')}>
                  <T size={12} weight="medium" color={CPACE.accent}>
                    View All
                  </T>
                </Pressable>
              }
            />
            {data.subjectMastery.slice(0, 4).map((s) => (
              <View key={s.id} style={styles.subjectRow}>
                <IconTile name={s.icon} color={s.color} bg={s.bg} tile={34} />
                <View style={{ flex: 1 }}>
                  <T weight="medium" size={13} numberOfLines={1}>
                    {s.code}
                  </T>
                  <View style={{ marginTop: 5 }}>
                    <ProgressBar value={s.mastery} color={s.color} track={CPACE.gray200} height={6} />
                  </View>
                </View>
                <T weight="semibold" size={13} color={CPACE.gray700}>
                  {s.mastery}%
                </T>
              </View>
            ))}
          </Card>

          {/* Top weaknesses */}
          <Card style={{ marginBottom: 16 }}>
            <SectionHeader
              title="Top Weaknesses"
              action={
                <Pressable onPress={() => router.push('/performance')}>
                  <T size={12} weight="medium" color={CPACE.accent}>
                    Focus Areas
                  </T>
                </Pressable>
              }
            />
            {data.weaknesses.map((w, i) => (
              <View key={w.topic} style={styles.weakRow}>
                <View style={[styles.weakNum, { backgroundColor: [CPACE.accent, CPACE.orange, CPACE.primary][i] ?? CPACE.primary }]}>
                  <T weight="bold" size={12} color="#fff">
                    {i + 1}
                  </T>
                </View>
                <View style={{ flex: 1 }}>
                  <T weight="semibold" size={13}>
                    {w.topic}
                  </T>
                  <T size={11} color={CPACE.gray500}>
                    {w.subjectCode} · {Math.round(w.accuracy)}% accuracy
                  </T>
                </View>
                <FontAwesome6 name="chevron-right" size={12} color={CPACE.gray400} />
              </View>
            ))}
          </Card>

          {/* Recent activity */}
          <Card style={{ marginBottom: 8 }}>
            <SectionHeader title="Recent Activity" />
            {data.recentActivity.map((a) => (
              <View key={a.id} style={styles.activityRow}>
                <IconTile name="clipboard-list" color={CPACE.green} bg={CPACE.greenBg} tile={36} />
                <View style={{ flex: 1 }}>
                  <T weight="semibold" size={13}>
                    {ACTIVITY_LABELS[a.type] ?? 'Quiz'}
                    {a.subjectCode ? ` · ${a.subjectCode}` : ''}
                  </T>
                  <T size={11} color={CPACE.gray500}>
                    {a.totalItems} questions{a.scorePercent !== null ? ` · ${Math.round(a.scorePercent)}%` : ''}
                  </T>
                </View>
                <T size={11} color={CPACE.gray500}>
                  {timeAgo(a.startedAt)}
                </T>
              </View>
            ))}
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}

function Metric({ icon, tint, bg, label, value, sub }: { icon: any; tint: string; bg: string; label: string; value: string; sub: string }) {
  return (
    <Card style={styles.metricCard}>
      <IconTile name={icon} color={tint} bg={bg} tile={36} />
      <T size={11} color={CPACE.gray500} style={{ marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </T>
      <T weight="bold" size={24} color={CPACE.gray900} style={{ marginTop: 2 }}>
        {value}
      </T>
      <T size={11} color={CPACE.gray500} style={{ marginTop: 2 }} numberOfLines={1}>
        {sub}
      </T>
    </Card>
  );
}

const styles = StyleSheet.create({
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 3,
    borderRadius: 9,
    backgroundColor: '#ff4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: CPACE.primaryMid,
  },
  content: { padding: 16, paddingBottom: 28 },
  banner: {
    backgroundColor: '#fdf0f0',
    borderRadius: Radius.lg,
    padding: 18,
    marginBottom: 16,
  },
  countdown: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  metricCard: { width: '47.8%', flexGrow: 1, padding: 16 },
  action: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionPrimary: { backgroundColor: CPACE.primary },
  actionOutline: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: CPACE.primary },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  weakRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: CPACE.divider },
  weakNum: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: CPACE.divider },
});
