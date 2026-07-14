import { Card, Loader, ProgressBar, Screen, T } from '@/components/cpace-ui';
import { CPACE, Radius } from '@/constants/theme';
import { api } from '@/lib/api';
import type { Achievement } from '@/lib/types';
import { FontAwesome6 } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

export default function AchievementsScreen() {
  const [items, setItems] = useState<Achievement[] | null>(null);

  useEffect(() => {
    api.getAchievements().then(setItems);
  }, []);

  if (!items) return <Screen><Loader /></Screen>;

  const unlocked = items.filter((a) => a.unlocked).length;
  const points = items.filter((a) => a.unlocked).reduce((s, a) => s + a.points, 0);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.summary}>
          <View style={styles.summaryItem}>
            <T weight="bold" size={26} color={CPACE.primary}>
              {unlocked}/{items.length}
            </T>
            <T size={12} color={CPACE.gray500}>
              Unlocked
            </T>
          </View>
          <View style={styles.vline} />
          <View style={styles.summaryItem}>
            <T weight="bold" size={26} color={CPACE.orange}>
              {points}
            </T>
            <T size={12} color={CPACE.gray500}>
              Points earned
            </T>
          </View>
        </Card>

        <View style={{ gap: 12, marginTop: 16 }}>
          {items.map((a) => (
            <Card key={a.id} style={[styles.card, !a.unlocked && { opacity: 0.95 }]}>
              <View style={[styles.badge, { backgroundColor: a.unlocked ? CPACE.primaryLight : CPACE.gray200 }]}>
                <FontAwesome6 name={a.icon as any} size={20} color={a.unlocked ? CPACE.primary : CPACE.gray400} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <T weight="semibold" size={14}>
                    {a.title}
                  </T>
                  {a.unlocked ? <FontAwesome6 name="circle-check" size={13} color={CPACE.green} /> : null}
                </View>
                <T size={12} color={CPACE.gray500} style={{ marginBottom: 8 }}>
                  {a.description}
                </T>
                {a.unlocked ? (
                  <T weight="semibold" size={11} color={CPACE.orange}>
                    +{a.points} points
                  </T>
                ) : (
                  <>
                    <ProgressBar value={a.progress} color={CPACE.orange} track={CPACE.gray200} height={6} />
                    <T size={11} color={CPACE.gray500} style={{ marginTop: 4 }}>
                      {a.progress}% complete
                    </T>
                  </>
                )}
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 28 },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center', flex: 1 },
  vline: { width: 1, height: 40, backgroundColor: CPACE.gray200 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  badge: { width: 52, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
