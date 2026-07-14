import { Loader, ProgressBar, Screen, T } from '@/components/cpace-ui';
import { CPACE, Radius } from '@/constants/theme';
import { api } from '@/lib/api';
import type { QuizResult, QuizSession } from '@/lib/types';
import { FontAwesome6 } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

export default function QuizScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; subject?: string; subjectId?: string; count?: string }>();
  const training = params.mode === 'training';

  const [session, setSession] = useState<QuizSession | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({}); // question id -> choice id
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finishedRef = useRef(false);
  const sessionIdRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let subjectId = Number(params.subjectId) || 0;
        if (!subjectId) {
          // "All subjects" — pick a random subject for this session
          const subjects = await api.getSubjects();
          subjectId = subjects[Math.floor(Math.random() * subjects.length)].id;
        }
        const s = await api.startQuiz({
          subjectId,
          count: Number(params.count) || 5,
          training,
        });
        if (!alive) {
          api.cancelQuiz(s.sessionId);
          return;
        }
        sessionIdRef.current = s.sessionId;
        setSession(s);
      } catch (e: any) {
        if (alive) setError(e?.message ?? 'Could not start the quiz.');
      }
    })();
    return () => {
      alive = false;
      // Abandoning mid-quiz: clean up the unfinished session on the server.
      if (sessionIdRef.current && !finishedRef.current) {
        api.cancelQuiz(sessionIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const questions = session?.questions ?? [];
  const q = questions[index];
  const total = questions.length;
  const selected = q ? (answers[q.id] ?? null) : null;

  const choose = (choiceId: number) => {
    if (!q) return;
    setAnswers((a) => ({ ...a, [q.id]: choiceId }));
  };

  const next = async () => {
    if (index + 1 < total) {
      setIndex((i) => i + 1);
      return;
    }
    // Finish: server grades the quiz, updates performance, points & streak.
    if (!session) return;
    setSubmitting(true);
    try {
      const res = await api.submitQuiz(session.sessionId, answers);
      finishedRef.current = true;
      setResult(res);
    } catch (e: any) {
      Alert.alert('Submit failed', e?.message ?? 'Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Quiz' }} />
        <View style={styles.resultWrap}>
          <FontAwesome6 name="triangle-exclamation" size={30} color={CPACE.orange} />
          <T size={14} color={CPACE.gray700} style={{ marginTop: 12, textAlign: 'center' }}>
            {error}
          </T>
          <Pressable style={[styles.btn, styles.btnPrimary, { marginTop: 24, paddingHorizontal: 28 }]} onPress={() => router.back()}>
            <T weight="semibold" size={15} color="#fff">
              Go back
            </T>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Quiz' }} />
        <Loader />
      </Screen>
    );
  }

  if (result) {
    const pass = result.scorePercent >= 75;
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Results' }} />
        <ScrollView contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center' }}>
            <View style={[styles.resultCircle, { borderColor: pass ? CPACE.green : CPACE.accent }]}>
              <T weight="bold" size={40} color={pass ? CPACE.green : CPACE.accent}>
                {result.scorePercent}%
              </T>
              <T size={12} color={CPACE.gray500}>
                {result.correct}/{result.totalItems} correct
              </T>
            </View>
            <T weight="bold" size={20} style={{ marginTop: 20 }}>
              {pass ? 'Great work! 🎉' : 'Keep practicing 💪'}
            </T>
            <T size={13} color={CPACE.gray500} style={{ marginTop: 6, textAlign: 'center' }}>
              {pass ? "You're above the 75% board passing mark." : 'Aim for 75%+ to be board-ready on this topic.'}
            </T>
          </View>

          {/* Per-question review */}
          <T weight="semibold" size={14} style={{ marginTop: 28, marginBottom: 10 }}>
            Review your answers
          </T>
          <View style={{ gap: 12 }}>
            {result.questions.map((rq, i) => {
              const ok = rq.isCorrect === true;
              return (
                <View key={rq.id} style={styles.reviewCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <FontAwesome6
                      name={ok ? 'circle-check' : 'circle-xmark'}
                      size={16}
                      color={ok ? CPACE.green : CPACE.danger}
                    />
                    <T weight="semibold" size={12} color={ok ? CPACE.green : CPACE.danger}>
                      Question {i + 1} · {ok ? 'Correct' : rq.selectedChoice === null ? 'Not answered' : 'Incorrect'}
                    </T>
                  </View>
                  <T size={13} style={{ lineHeight: 19, marginBottom: 6 }}>
                    {rq.stem}
                  </T>
                  {rq.selectedChoice !== null ? (
                    <T size={12} color={CPACE.gray700}>
                      Your answer: {rq.choices.find((c) => c.id === rq.selectedChoice)?.text ?? '—'}
                    </T>
                  ) : null}
                  {rq.explanation ? (
                    <View style={styles.explain}>
                      <T weight="semibold" size={12} color={CPACE.primary} style={{ marginBottom: 2 }}>
                        Explanation
                      </T>
                      <T size={12} color={CPACE.gray700} style={{ lineHeight: 18 }}>
                        {rq.explanation}
                      </T>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          <Pressable style={[styles.btn, styles.btnPrimary, { marginTop: 24 }]} onPress={() => router.back()}>
            <T weight="semibold" size={15} color="#fff">
              Done
            </T>
          </Pressable>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: `Question ${index + 1} of ${total}` }} />
      <View style={styles.progressWrap}>
        <ProgressBar value={((index + (selected ? 1 : 0)) / Math.max(total, 1)) * 100} color={CPACE.primary} track={CPACE.gray200} height={6} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.qMeta}>
          <View style={styles.subjectTag}>
            <T weight="semibold" size={11} color={CPACE.primary}>
              {session.subjectCode ?? 'QUIZ'}
            </T>
          </View>
          <T size={11} color={CPACE.gray500}>
            {training ? 'Training' : 'Adaptive'} · {q?.difficulty}
          </T>
        </View>

        <T weight="semibold" size={17} style={{ lineHeight: 25, marginBottom: 20 }}>
          {q?.stem}
        </T>

        <View style={{ gap: 12 }}>
          {q?.choices.map((c) => {
            const isSelected = selected === c.id;
            const border = isSelected ? CPACE.primary : CPACE.gray300;
            const bg = isSelected ? '#fffafa' : '#fff';
            return (
              <Pressable key={c.id} onPress={() => choose(c.id)} style={[styles.choice, { borderColor: border, backgroundColor: bg }]}>
                <View style={[styles.choiceKey, { borderColor: border }]}>
                  <T weight="bold" size={12} color={isSelected ? CPACE.primary : CPACE.gray700}>
                    {c.key}
                  </T>
                </View>
                <T size={14} style={{ flex: 1 }} color={CPACE.gray900}>
                  {c.text}
                </T>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.btn, selected && !submitting ? styles.btnPrimary : styles.btnDisabled]}
          disabled={!selected || submitting}
          onPress={next}
        >
          <T weight="semibold" size={15} color="#fff">
            {submitting ? 'Submitting...' : index + 1 >= total ? 'Finish' : 'Next'}
          </T>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressWrap: { paddingHorizontal: 16, paddingTop: 14 },
  content: { padding: 16, paddingBottom: 20 },
  qMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  subjectTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: CPACE.primaryLight },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    padding: 14,
  },
  choiceKey: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explain: { marginTop: 10, backgroundColor: CPACE.primaryLight, borderRadius: Radius.md, padding: 10 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: CPACE.border, backgroundColor: '#fff' },
  btn: { height: 50, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: CPACE.primary },
  btnDisabled: { backgroundColor: CPACE.gray300 },
  resultWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  resultScroll: { padding: 20, paddingBottom: 32 },
  resultCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: CPACE.gray200,
    padding: 14,
  },
});
