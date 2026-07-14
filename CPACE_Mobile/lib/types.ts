// Domain types for the CPACE student mobile app.
// Shapes mirror what the Laravel PHP API returns (mapped in lib/api.ts).

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'student';
  examDate: string | null; // ISO date of target board exam
}

export interface Subject {
  id: number;
  code: string; // FAR, AFAR, MS, TAX, AUD, RFBT
  name: string;
  mastery: number; // 0-100
  questionCount: number;
  color: string;
  bg: string;
  icon: string; // FontAwesome name
}

export interface Topic {
  id: number;
  subjectId: number;
  name: string;
  accuracy: number; // 0-100
}

export interface DashboardSummary {
  readiness: number;
  questionsAttempted: number;
  questionsThisWeek: number;
  studyHours: number;
  studyHoursWeek: number;
  streak: number;
  daysToExam: number | null;
  unreadNotifications: number;
  subjectMastery: Subject[];
  weaknesses: { topic: string; subjectCode: string; accuracy: number }[];
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: number;
  type: 'training' | 'testing' | 'spaced_review' | 'mock_exam';
  subjectCode: string | null;
  totalItems: number;
  scorePercent: number | null;
  startedAt: string; // ISO
}

export interface QuizChoice {
  id: number; // question_choices.id (sent back on submit)
  key: string; // A, B, C, D
  text: string;
}

export interface QuizQuestion {
  id: number;
  stem: string;
  difficulty: string;
  choices: QuizChoice[];
  explanation: string | null;
}

// A live quiz session started on the server.
export interface QuizSession {
  sessionId: number;
  subjectCode: string | null;
  timeLimit: number | null; // seconds, timed mode only
  questions: QuizQuestion[];
}

// Per-question outcome returned by the server after submit.
export interface QuizResultQuestion extends QuizQuestion {
  selectedChoice: number | null;
  isCorrect: boolean | null;
}

export interface QuizResult {
  scorePercent: number;
  correct: number;
  totalItems: number;
  questions: QuizResultQuestion[];
}

export interface QuizHistoryItem {
  id: number;
  type: 'training' | 'testing';
  subjectCode: string | null; // null = mixed / all subjects
  totalItems: number;
  correct: number;
  scorePercent: number;
  completedAt: string; // ISO
}

export interface ReviewNote {
  id: number;
  title: string;
  subjectCode: string;
  body: string;
  favorite: boolean;
  updatedAt: string; // ISO-ish date string
}

export interface PerformanceData {
  readiness: number;
  accuracyTrend: number[]; // last N days accuracy
  bySubject: { code: string; name: string; accuracy: number; attempted: number }[];
  weaknesses: { topic: string; subjectCode: string; accuracy: number }[];
  strengths: { topic: string; subjectCode: string; accuracy: number }[];
}

export interface ReviewDue {
  id: number;
  date: string; // ISO date (yyyy-mm-dd)
  topic: string;
  subjectCode: string;
  itemsDue: number;
  status: 'due' | 'upcoming' | 'done';
}

export interface Achievement {
  id: number;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number; // 0-100
  points: number;
}
