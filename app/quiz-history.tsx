import { Card, IconTile, Loader, Screen, T } from '@/components/cpace-ui';
import { CPACE, Radius } from '@/constants/theme';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import type { QuizHistoryItem } from '@/lib/types';
import { FontAwesome6 } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

const TYPE_LABELS = { training: 'Training Quiz', testing: 'Adaptive Quiz' } as const;

function scoreColor(pct: number) {
  if (pct >= 75) return { color: CPACE.green, bg: CPACE.greenBg };
  if (pct >= 60) return { color: CPACE.orange, bg: CPACE.orangeBg };
  return { color: CPACE.accent, bg: CPACE.redBg };
}

export default function QuizHistoryScreen() {
  const [items, setItems] = useState<QuizHistoryItem[] | null>(null);

  // Refetch on focus so a quiz finished moments ago shows up immediately.
  useFocusEffect(
    useCallback(() => {
      api.getQuizHistory().then(setItems);
    }, [])
  );

  if (!items) return <Screen><Loader /></Screen>;

  const avg = items.length ? Math.round(items.reduce((s, i) => s + i.scorePercent, 0) / items.length) : 0;
  const passed = items.filter((i) => i.scorePercent >= 75).length;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <T weight="bold" size={22} color={CPACE.gray900}>
              {items.length}
            </T>
            <T size={11} color={CPACE.gray500}>
              Quizzes taken
            </T>
          </Card>
          <Card style={styles.statCard}>
            <T weight="bold" size={22} color={avg >= 75 ? CPACE.green : CPACE.accent}>
              {avg}%
            </T>
            <T size={11} color={CPACE.gray500}>
              Average score
            </T>
          </Card>
          <Card style={styles.statCard}>
            <T weight="bold" size={22} color={CPACE.gray900}>
              {passed}/{items.length}
            </T>
            <T size={11} color={CPACE.gray500}>
              Above 75%
            </T>
          </Card>
        </View>

        {items.length === 0 ? (
          <Card style={styles.empty}>
            <FontAwesome6 name="clipboard-list" size={22} color={CPACE.gray400} />
            <T size={12} color={CPACE.gray500} style={{ marginTop: 8 }}>
              No quizzes taken yet — start one from the Quizzes tab
            </T>
          </Card>
        ) : (
          <View style={{ gap: 10, marginTop: 16 }}>
            {items.map((it) => {
              const s = scoreColor(it.scorePercent);
              return (
                <Card key={it.id} style={styles.row}>
                  <IconTile
                    name={it.type === 'training' ? 'graduation-cap' : 'bolt'}
                    color={it.type === 'training' ? CPACE.blue : CPACE.primary}
                    bg={it.type === 'training' ? CPACE.blueBg : CPACE.primaryLight}
                    tile={40}
                  />
                  <View style={{ flex: 1 }}>
                    <T weight="semibold" size={13}>
                      {TYPE_LABELS[it.type]}
                      {it.subjectCode ? ` · ${it.subjectCode}` : ' · All subjects'}
                    </T>
                    <T size={11} color={CPACE.gray500}>
                      {it.correct}/{it.totalItems} correct · {timeAgo(it.completedAt)}
                    </T>
                  </View>
                  <View style={[styles.scoreBadge, { backgroundColor: s.bg }]}>
                    <T weight="bold" size={13} color={s.color}>
                      {it.scorePercent}%
                    </T>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 28 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scoreBadge: {
    minWidth: 52,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  empty: { alignItems: 'center', paddingVertical: 26, marginTop: 16 },
});
