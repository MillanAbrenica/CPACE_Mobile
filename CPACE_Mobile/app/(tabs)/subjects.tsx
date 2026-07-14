import { AppHeader, Card, IconTile, Loader, ProgressBar, Screen, T } from '@/components/cpace-ui';
import { CPACE } from '@/constants/theme';
import { api } from '@/lib/api';
import type { Subject } from '@/lib/types';
import { FontAwesome6 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

export default function SubjectsScreen() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[] | null>(null);

  useEffect(() => {
    api.getSubjects().then(setSubjects);
  }, []);

  return (
    <Screen>
      <AppHeader title="Subjects" subtitle="6 CPA board exam areas" />
      {!subjects ? (
        <Loader />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {subjects.map((s) => (
            <Pressable key={s.id} onPress={() => router.push('/(tabs)/quizzes')}>
              <Card style={styles.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <IconTile name={s.icon} color={s.color} bg={s.bg} tile={48} size={20} />
                  <View style={{ flex: 1 }}>
                    <T weight="semibold" size={15}>
                      {s.code}
                    </T>
                    <T size={11} color={CPACE.gray500} numberOfLines={1}>
                      {s.name}
                    </T>
                  </View>
                  <FontAwesome6 name="chevron-right" size={13} color={CPACE.gray400} />
                </View>

                <View style={styles.metaRow}>
                  <T size={11} color={CPACE.gray500}>
                    {s.questionCount} practice questions
                  </T>
                  <T weight="semibold" size={13} color={s.color}>
                    {s.mastery}%
                  </T>
                </View>
                <ProgressBar value={s.mastery} color={s.color} track={CPACE.gray200} height={7} />
              </Card>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 28, gap: 12 },
  card: { gap: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
