// Real API service layer.
// Every screen calls these functions; each one hits the Laravel (PHP) API
// of the CPACE web app (served by XAMPP) and maps the JSON payloads to the
// mobile domain types in ./types.

import { CPACE } from '@/constants/theme';
import { request, setToken } from './http';
import type {
  Achievement,
  DashboardSummary,
  PerformanceData,
  QuizHistoryItem,
  QuizResult,
  QuizSession,
  ReviewDue,
  ReviewNote,
  Subject,
  User,
} from './types';

// ── Presentation decoration (icons/colors per subject) ─────────────────────

const SUBJECT_ICONS: Record<string, string> = {
  FAR: 'book',
  AFAR: 'layer-group',
  MS: 'chart-line',
  TAX: 'file-invoice-dollar',
  AUD: 'magnifying-glass-chart',
  RFBT: 'scale-balanced',
};

// The web DB stores FontAwesome web classes like "fa-book"; mobile wants "book".
function faName(icon: string | null, code: string): string {
  if (icon) return icon.replace(/^fa-/, '');
  return SUBJECT_ICONS[code] ?? 'book';
}

function lightBg(hex: string | null): string {
  return hex ? `${hex}1A` : CPACE.redBg; // ~10% alpha tint of the subject color
}

function mapSubject(s: any): Subject {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    mastery: Number(s.mastery ?? 0),
    questionCount: Number(s.question_count ?? 0),
    color: s.color ?? CPACE.primary,
    bg: lightBg(s.color ?? null),
    icon: faName(s.icon ?? null, s.code),
  };
}

function mapUser(u: any): User {
  return {
    id: u.id,
    name: u.name ?? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
    email: u.email,
    role: 'student',
    examDate: u.exam_target_date ?? null,
  };
}

let subjectsCache: Subject[] | null = null;

async function subjectList(): Promise<Subject[]> {
  if (!subjectsCache) {
    const res = await request<{ subjects: any[] }>('/subjects');
    subjectsCache = res.subjects.map(mapSubject);
  }
  return subjectsCache;
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<User> {
    const res = await request<{ token: string; user: any }>('/login', {
      method: 'POST',
      auth: false,
      body: { email, password },
    });
    await setToken(res.token);
    return mapUser(res.user);
  },

  async signup(name: string, email: string, password: string): Promise<User> {
    const parts = name.trim().split(/\s+/);
    const firstName = parts.slice(0, -1).join(' ') || parts[0];
    const lastName = parts.length > 1 ? parts[parts.length - 1] : '-';
    const res = await request<{ token: string; user: any }>('/signup', {
      method: 'POST',
      auth: false,
      body: {
        first_name: firstName,
        last_name: lastName,
        email,
        password,
        password_confirmation: password,
      },
    });
    await setToken(res.token);
    return mapUser(res.user);
  },

  async me(): Promise<User> {
    const res = await request<{ user: any }>('/user');
    return mapUser(res.user);
  },

  async logout(): Promise<void> {
    try {
      await request('/logout', { method: 'POST' });
    } catch {
      // token may already be invalid; clearing locally is what matters
    }
    await setToken(null);
    subjectsCache = null;
  },

  // ── Dashboard ─────────────────────────────────────────────────────────

  async getDashboard(): Promise<DashboardSummary> {
    const d = await request<any>('/dashboard');
    return {
      readiness: Number(d.readiness ?? 0),
      questionsAttempted: Number(d.questions_attempted ?? 0),
      questionsThisWeek: Number(d.questions_this_week ?? 0),
      studyHours: Number(d.study_hours ?? 0),
      studyHoursWeek: Number(d.study_hours_week ?? 0),
      streak: Number(d.streak ?? 0),
      daysToExam: d.days_to_exam ?? null,
      unreadNotifications: Number(d.unread_notifications ?? 0),
      subjectMastery: (d.subject_mastery ?? []).map((s: any) => mapSubject(s)),
      weaknesses: (d.weaknesses ?? []).map((w: any) => ({
        topic: w.topic,
        subjectCode: w.subject_code,
        accuracy: Number(w.accuracy_rate ?? 0),
      })),
      recentActivity: (d.recent_activity ?? []).map((a: any) => ({
        id: a.id,
        type: a.session_type,
        subjectCode: a.subject_code ?? null,
        totalItems: Number(a.total_items ?? 0),
        scorePercent: a.score_percent !== null ? Number(a.score_percent) : null,
        startedAt: a.started_at,
      })),
    };
  },

  // ── Subjects ──────────────────────────────────────────────────────────

  async getSubjects(): Promise<Subject[]> {
    subjectsCache = null; // always refresh mastery numbers
    return subjectList();
  },

  // ── Quiz engine (server-graded sessions) ──────────────────────────────

  async startQuiz(input: {
    subjectId: number;
    count: number;
    training: boolean;
  }): Promise<QuizSession> {
    const started = await request<{ session_id: number; time_limit: number | null }>(
      '/quizzes/start',
      {
        method: 'POST',
        body: {
          subject_id: input.subjectId,
          mode: 'adaptive',
          count: input.count,
          session_type: input.training ? 'training' : 'testing',
        },
      },
    );

    const take = await request<any>(`/quizzes/${started.session_id}`);
    return {
      sessionId: started.session_id,
      subjectCode: take.session?.subject_code ?? null,
      timeLimit: take.time_limit ?? null,
      questions: (take.questions ?? []).map((q: any) => ({
        id: q.id,
        stem: q.question_text,
        difficulty: q.difficulty,
        explanation: q.explanation ?? null,
        choices: (q.choices ?? []).map((c: any) => ({
          id: c.id,
          key: c.choice_label,
          text: c.choice_text,
        })),
      })),
    };
  },

  /** answers: question_id -> selected choice id (question_choices.id) */
  async submitQuiz(sessionId: number, answers: Record<number, number>): Promise<QuizResult> {
    await request(`/quizzes/${sessionId}/submit`, { method: 'POST', body: { answers } });

    const res = await request<any>(`/quizzes/${sessionId}/results`);
    const questions = (res.questions ?? []).map((q: any) => ({
      id: q.id,
      stem: q.question_text,
      difficulty: q.difficulty,
      explanation: q.explanation ?? null,
      choices: (q.choices ?? []).map((c: any) => ({
        id: c.id,
        key: c.choice_label,
        text: c.choice_text,
      })),
      selectedChoice: q.selected_choice ?? null,
      isCorrect: q.is_correct === null ? null : Boolean(q.is_correct),
    }));

    return {
      scorePercent: Math.round(Number(res.session?.score_percent ?? 0)),
      correct: Number(res.session?.correct_answers ?? 0),
      totalItems: Number(res.session?.total_items ?? questions.length),
      questions,
    };
  },

  async cancelQuiz(sessionId: number): Promise<void> {
    try {
      await request(`/quizzes/${sessionId}/cancel`, { method: 'POST' });
    } catch {
      // best-effort cleanup
    }
  },

  async getQuizHistory(): Promise<QuizHistoryItem[]> {
    const res = await request<{ data: any[] }>('/quizzes/history');
    return (res.data ?? []).map((s: any) => ({
      id: s.id,
      type: s.session_type === 'training' ? 'training' : 'testing',
      subjectCode: s.subject_code ?? null,
      totalItems: Number(s.total_items ?? 0),
      correct: Number(s.correct_answers ?? 0),
      scorePercent: Math.round(Number(s.score_percent ?? 0)),
      completedAt: s.completed_at,
    }));
  },

  // ── Review notes ──────────────────────────────────────────────────────

  async getReviewNotes(): Promise<ReviewNote[]> {
    const res = await request<{ data: any[] }>('/review-notes');
    return (res.data ?? []).map((n: any) => ({
      id: n.id,
      title: n.title,
      subjectCode: n.subject_code ?? 'ALL',
      body: n.content ?? '',
      favorite: Boolean(n.is_favorite),
      updatedAt: n.created_on ?? new Date().toISOString(),
    }));
  },

  async saveReviewNote(input: {
    id?: number;
    title: string;
    subjectCode: string;
    body: string;
  }): Promise<void> {
    const subjects = await subjectList();
    const subjectId = subjects.find((s) => s.code === input.subjectCode)?.id ?? null;
    const body = { title: input.title, content: input.body, subject_id: subjectId };
    if (input.id) {
      await request(`/review-notes/${input.id}`, { method: 'PUT', body });
    } else {
      await request('/review-notes', { method: 'POST', body });
    }
  },

  async toggleFavorite(id: number): Promise<void> {
    await request(`/review-notes/${id}/favorite`, { method: 'POST' });
  },

  async deleteReviewNote(id: number): Promise<void> {
    await request(`/review-notes/${id}`, { method: 'DELETE' });
  },

  // ── Performance ───────────────────────────────────────────────────────

  async getPerformance(): Promise<PerformanceData> {
    const res = await request<any>('/performance');
    const mapTopic = (t: any) => ({
      topic: t.topic,
      subjectCode: t.subject_code,
      accuracy: Number(t.accuracy ?? 0),
    });
    return {
      readiness: Number(res.stats?.accuracy ?? 0),
      accuracyTrend: (res.daily_series ?? []).map((d: any) => Number(d.accuracy ?? 0)),
      bySubject: (res.subject_accuracy ?? []).map((s: any) => ({
        code: s.code,
        name: s.name,
        accuracy: Number(s.accuracy ?? 0),
        attempted: 0,
      })),
      weaknesses: (res.weaknesses ?? []).map(mapTopic),
      strengths: (res.strengths ?? []).map(mapTopic),
    };
  },

  // ── Spaced repetition calendar ────────────────────────────────────────

  /** month: 'YYYY-MM'; defaults to the current month on the server. */
  async getReviewSchedule(month?: string): Promise<ReviewDue[]> {
    const res = await request<any>(`/calendar${month ? `?month=${month}` : ''}`);
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const items: ReviewDue[] = [];
    let id = 1;
    for (const week of res.weeks ?? []) {
      for (const day of week) {
        if (day.muted) continue;
        for (const ev of day.events ?? []) {
          items.push({
            id: id++,
            date: day.date,
            topic: ev.topic,
            subjectCode: ev.subject_code,
            itemsDue: Number(ev.count ?? 1),
            status: day.date <= todayKey ? 'due' : 'upcoming',
          });
        }
      }
    }
    return items;
  },

  // ── Achievements ──────────────────────────────────────────────────────
  // The web app exposes no badges API, so these are derived client-side
  // from the student's real progress data.

  async getAchievements(): Promise<Achievement[]> {
    const [d, history] = await Promise.all([this.getDashboard(), this.getQuizHistory()]);
    const bestScore = history.reduce((max, h) => Math.max(max, h.scorePercent), 0);
    const pct = (value: number, target: number) =>
      Math.min(100, Math.round((value / target) * 100));

    const defs = [
      { id: 1, title: 'First Steps', description: 'Complete your first quiz', icon: 'shoe-prints', progress: pct(history.length, 1), points: 10 },
      { id: 2, title: 'On Fire', description: 'Maintain a 7-day study streak', icon: 'fire', progress: pct(d.streak, 7), points: 50 },
      { id: 3, title: 'Centurion', description: 'Answer 100 questions', icon: 'medal', progress: pct(d.questionsAttempted, 100), points: 30 },
      { id: 4, title: 'Sharpshooter', description: 'Score 90%+ on any quiz', icon: 'bullseye', progress: pct(bestScore, 90), points: 40 },
      { id: 5, title: 'Board Ready', description: 'Reach 80% overall readiness', icon: 'graduation-cap', progress: pct(d.readiness, 80), points: 100 },
      { id: 6, title: 'Marathoner', description: 'Study for 50 total hours', icon: 'stopwatch', progress: pct(d.studyHours, 50), points: 60 },
    ];

    return defs.map((a) => ({ ...a, unlocked: a.progress >= 100 }));
  },
};
