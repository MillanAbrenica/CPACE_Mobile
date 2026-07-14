import { AppHeader, Card, IconTile, Loader, Screen, SectionHeader, T } from '@/components/cpace-ui';
import { CPACE, Radius } from '@/constants/theme';
import { api } from '@/lib/api';
import type { Subject } from '@/lib/types';
import { FontAwesome6 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

const MODES = [
  { key: 'testing', title: 'Adaptive Quiz', desc: 'Difficulty adjusts to your skill', icon: 'wand-magic-sparkles', tint: CPACE.accent, bg: CPACE.redBg },
  { key: 'training', title: 'Training Mode', desc: 'Practice with instant feedback', icon: 'dumbbell', tint: CPACE.green, bg: CPACE.greenBg },
  { key: 'spaced_review', title: 'Spaced Review', desc: 'Review topics due today', icon: 'rotate', tint: CPACE.blue, bg: CPACE.blueBg },
] as const;

const COUNTS = [5, 10, 20];

export default function QuizzesScreen() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [mode, setMode] = useState<string>('testing');
  const [subject, setSubject] = useState<string>('ALL');
  const [count, setCount] = useState(5);

  useEffect(() => {
    api.getSubjects().then(setSubjects);
  }, []);

  const start = () => {
    const subjectId = subjects?.find((s) => s.code === subject)?.id;
    router.push({
      pathname: '/quiz',
      params: { mode, subject, subjectId: subjectId ? String(subjectId) : '', count: String(count) },
    });
  };

  return (
    <Screen>
      <AppHeader title="Adaptive Quizzes" subtitle="Build a session and start practicing" />
      {!subjects ? (
        <Loader />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <SectionHeader title="Choose a mode" />
          <View style={{ gap: 12, marginBottom: 22 }}>
            {MODES.map((m) => {
              const active = mode === m.key;
              return (
                <Pressable key={m.key} onPress={() => setMode(m.key)}>
                  <Card style={[styles.modeCard, active && styles.modeActive]}>
                    <IconTile name={m.icon} color={m.tint} bg={m.bg} tile={44} size={18} />
                    <View style={{ flex: 1 }}>
                      <T weight="semibold" size={14}>
                        {m.title}
                      </T>
                      <T size={11} color={CPACE.gray500}>
                        {m.desc}
                      </T>
                    </View>
                    <FontAwesome6 name={active ? 'circle-check' : 'circle'} size={20} color={active ? CPACE.primary : CPACE.gray300} />
                  </Card>
                </Pressable>
              );
            })}
          </View>

          <SectionHeader title="Subject" />
          <View style={styles.chips}>
            <Chip label="All Subjects" active={subject === 'ALL'} onPress={() => setSubject('ALL')} />
            {subjects.map((s) => (
              <Chip key={s.id} label={s.code} active={subject === s.code} onPress={() => setSubject(s.code)} />
            ))}
          </View>

          <SectionHeader title="Number of questions" />
          <View style={[styles.chips, { marginBottom: 24 }]}>
            {COUNTS.map((c) => (
              <Chip key={c} label={`${c}`} active={count === c} onPress={() => setCount(c)} />
            ))}
          </View>

          <Pressable style={styles.startBtn} onPress={start}>
            <FontAwesome6 name="play" size={14} color="#fff" />
            <T weight="semibold" size={15} color="#fff">
              Start Quiz
            </T>
          </Pressable>
        </ScrollView>
      )}
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <T weight="medium" size={13} color={active ? '#fff' : CPACE.gray700}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 28 },
  modeCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderColor: 'transparent' },
  modeActive: { borderColor: CPACE.primary, backgroundColor: '#fffafa' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: {
    paddingHorizontal: 16,
    height: 38,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: CPACE.gray300,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: CPACE.primary, borderColor: CPACE.primary },
  startBtn: {
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: CPACE.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
});
