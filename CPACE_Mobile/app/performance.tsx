import { Card, Loader, ProgressBar, Screen, SectionHeader, T } from '@/components/cpace-ui';
import { CPACE, Radius } from '@/constants/theme';
import { api } from '@/lib/api';
import type { PerformanceData } from '@/lib/types';
import { FontAwesome6 } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

export default function PerformanceScreen() {
  const [data, setData] = useState<PerformanceData | null>(null);

  useEffect(() => {
    api.getPerformance().then(setData);
  }, []);

  if (!data) return <Screen><Loader /></Screen>;

  const maxTrend = Math.max(1, ...data.accuracyTrend);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Readiness hero */}
        <Card style={styles.hero}>
          <T size={12} color={CPACE.gray500} style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Board Readiness
          </T>
          <T weight="bold" size={44} color={CPACE.primary} style={{ marginVertical: 2 }}>
            {data.readiness}%
          </T>
          <ProgressBar value={data.readiness} color={CPACE.primary} track={CPACE.gray200} height={10} />
          <T size={12} color={CPACE.gray500} style={{ marginTop: 8 }}>
            Aim for 75%+ across all subjects to be board-ready.
          </T>
        </Card>

        {/* Accuracy trend */}
        <Card style={{ marginBottom: 16 }}>
          <SectionHeader title="Accuracy Trend" />
          <View style={styles.chart}>
            {data.accuracyTrend.map((v, i) => (
              <View key={i} style={styles.barWrap}>
                <View style={[styles.bar, { height: `${(v / maxTrend) * 100}%` }]} />
              </View>
            ))}
          </View>
          <T size={11} color={CPACE.gray500} style={{ textAlign: 'center', marginTop: 8 }}>
            Last {data.accuracyTrend.length} sessions
          </T>
        </Card>

        {/* By subject */}
        <Card style={{ marginBottom: 16 }}>
          <SectionHeader title="By Subject" />
          {data.bySubject.map((s) => (
            <View key={s.code} style={styles.subjectRow}>
              <View style={{ width: 52 }}>
                <T weight="semibold" size={13}>
                  {s.code}
                </T>
              </View>
              <View style={{ flex: 1 }}>
                <ProgressBar value={s.accuracy} color={CPACE.primary} track={CPACE.gray200} height={7} />
              </View>
              <T weight="semibold" size={13} color={CPACE.gray700} style={{ width: 40, textAlign: 'right' }}>
                {s.accuracy}%
              </T>
            </View>
          ))}
        </Card>

        {/* Strengths & weaknesses */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Card style={{ flex: 1 }}>
            <View style={styles.swHeader}>
              <FontAwesome6 name="arrow-trend-up" size={13} color={CPACE.green} />
              <T weight="semibold" size={13}>
                Strengths
              </T>
            </View>
            {data.strengths.map((s) => (
              <View key={s.topic} style={{ marginBottom: 10 }}>
                <T size={12} numberOfLines={1}>
                  {s.topic}
                </T>
                <T size={11} color={CPACE.green}>
                  {s.subjectCode} · {s.accuracy}%
                </T>
              </View>
            ))}
          </Card>
          <Card style={{ flex: 1 }}>
            <View style={styles.swHeader}>
              <FontAwesome6 name="arrow-trend-down" size={13} color={CPACE.accent} />
              <T weight="semibold" size={13}>
                Weaknesses
              </T>
            </View>
            {data.weaknesses.map((s) => (
              <View key={s.topic} style={{ marginBottom: 10 }}>
                <T size={12} numberOfLines={1}>
                  {s.topic}
                </T>
                <T size={11} color={CPACE.accent}>
                  {s.subjectCode} · {Math.round(s.accuracy)}%
                </T>
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 28 },
  hero: { marginBottom: 16 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 120 },
  barWrap: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { backgroundColor: CPACE.primary, borderRadius: Radius.sm, width: '100%', minHeight: 6 },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  swHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
});
