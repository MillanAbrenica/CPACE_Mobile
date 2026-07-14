<?php
/**
 * Quiz engine — same process as the web API's QuizApiController:
 * server-side question selection (adaptive/topic/timed/challenge), deterministic
 * per-session choice shuffling + paraphrasing, server-side grading, performance
 * records, weakness sync, points, streak refresh, SM-2 scheduling.
 */

declare(strict_types=1);

const QUIZ_MAX_LENGTH        = 100;
const QUIZ_MODES             = ['adaptive', 'topic', 'timed', 'challenge'];
const TIMED_SECS_PER_QUESTION = 60;

// ── POST /api/quizzes/start ────────────────────────────────────────────────

function handle_quiz_start(object $user): never
{
    $data = body();
    $pdo = db();

    $subjectId = (int) ($data['subject_id'] ?? 0);
    $q = $pdo->prepare('SELECT id FROM subjects WHERE id = ? LIMIT 1');
    $q->execute([$subjectId]);
    if (! $q->fetch()) {
        validation_error(['subject_id' => ['The selected subject is invalid.']]);
    }
    if (empty($data['count']) || (int) $data['count'] < 1) {
        validation_error(['count' => ['The count field is required.']]);
    }

    $mode = in_array($data['mode'] ?? null, QUIZ_MODES, true) ? $data['mode'] : 'adaptive';
    $sessionType = in_array($data['session_type'] ?? null, ['training', 'testing'], true)
        ? $data['session_type']
        : 'testing';
    $count = max(1, min((int) $data['count'], QUIZ_MAX_LENGTH));

    $q = $pdo->prepare('SELECT id FROM topics WHERE subject_id = ?');
    $q->execute([$subjectId]);
    $topicIds = array_map('intval', $q->fetchAll(PDO::FETCH_COLUMN));

    [$questionIds, $focusTopicId] = select_questions($mode, $topicIds, (int) $user->id, $count);

    if (! $questionIds) {
        json_out(['message' => 'No questions are available for that subject yet.'], 422);
    }

    $pdo->prepare(
        'INSERT INTO quiz_sessions (student_id, session_type, mode, subject_id, topic_id, started_at, total_items, correct_answers)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
    )->execute([$user->id, $sessionType, $mode, $subjectId, $focusTopicId, now(), count($questionIds)]);
    $sessionId = (int) $pdo->lastInsertId();

    $ins = $pdo->prepare('INSERT INTO quiz_answers (session_id, question_id, answered_at) VALUES (?, ?, ?)');
    foreach ($questionIds as $qid) {
        $ins->execute([$sessionId, $qid, now()]);
    }

    json_out([
        'session_id' => $sessionId,
        'time_limit' => $mode === 'timed' ? count($questionIds) * TIMED_SECS_PER_QUESTION : null,
    ], 201);
}

// ── GET /api/quizzes/{id} ──────────────────────────────────────────────────

function handle_quiz_take(object $user, int $sessionId): never
{
    $session = owned_session((int) $user->id, $sessionId);

    if ($session->completed_at) {
        json_out(['completed' => true, 'session_id' => (int) $session->id]);
    }

    $q = db()->prepare('SELECT question_id FROM quiz_answers WHERE session_id = ?');
    $q->execute([$sessionId]);
    $questionIds = array_map('intval', $q->fetchAll(PDO::FETCH_COLUMN));

    $questions = present_questions($questionIds, $sessionId);

    json_out([
        'session'    => session_payload($session),
        'questions'  => array_map('question_payload', $questions),
        'time_limit' => $session->mode === 'timed' ? count($questions) * TIMED_SECS_PER_QUESTION : null,
    ]);
}

// ── POST /api/quizzes/{id}/submit ──────────────────────────────────────────

function handle_quiz_submit(object $user, int $sessionId): never
{
    $session = owned_session((int) $user->id, $sessionId);

    if ($session->completed_at) {
        json_out(['already_completed' => true]);
    }

    $submitted = body()['answers'] ?? [];
    $pdo = db();

    $q = $pdo->prepare('SELECT question_id FROM quiz_answers WHERE session_id = ?');
    $q->execute([$sessionId]);
    $questionIds = array_map('intval', $q->fetchAll(PDO::FETCH_COLUMN));

    $questions = fetch_questions($questionIds);

    $countsTowardProgress = $session->session_type !== 'training';

    $correctCount  = 0;
    $topicTally    = [];
    $answerResults = [];

    $pdo->beginTransaction();
    try {
        foreach ($questions as $question) {
            $correctChoiceId = null;
            foreach ($question->choices as $c) {
                if ((bool) $c->is_correct) {
                    $correctChoiceId = (int) $c->id;
                    break;
                }
            }

            $selected  = $submitted[(string) $question->id] ?? $submitted[$question->id] ?? null;
            $selected  = $selected !== null ? (int) $selected : null;
            $isCorrect = $selected !== null && $selected === $correctChoiceId;

            if ($isCorrect) {
                $correctCount++;
            }

            $answerResults[] = [
                'question_id' => (int) $question->id,
                'difficulty'  => $question->difficulty,
                'correct'     => $isCorrect,
            ];

            $pdo->prepare(
                'UPDATE quiz_answers SET selected_choice = ?, is_correct = ?, answered_at = ?
                 WHERE session_id = ? AND question_id = ?'
            )->execute([$selected, (int) $isCorrect, now(), $sessionId, $question->id]);

            $tid = (int) $question->topic_id;
            $topicTally[$tid] ??= ['attempts' => 0, 'correct' => 0];
            $topicTally[$tid]['attempts']++;
            $topicTally[$tid]['correct'] += $isCorrect ? 1 : 0;
        }

        $total = count($questions);
        $duration = max(0, time() - strtotime($session->started_at));
        $scorePercent = $total > 0 ? round($correctCount / $total * 100, 2) : 0;

        $pdo->prepare(
            'UPDATE quiz_sessions SET completed_at = ?, correct_answers = ?, score_percent = ?, duration_secs = ?
             WHERE id = ?'
        )->execute([now(), $correctCount, $scorePercent, $duration, $sessionId]);

        if ($countsTowardProgress) {
            update_performance_records((int) $user->id, $topicTally);
            award_points((int) $user->id, $correctCount, $session->mode);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    streak_refresh((int) $user->id);

    if ($countsTowardProgress) {
        try {
            sm2_record_answers((int) $user->id, $answerResults);
            weakness_sync_many((int) $user->id, array_keys($topicTally));
        } catch (Throwable $e) {
            error_log($e->getMessage());
        }
    }

    json_out(['session_id' => $sessionId, 'score_percent' => $scorePercent]);
}

// ── GET /api/quizzes/{id}/results ──────────────────────────────────────────

function handle_quiz_results(object $user, int $sessionId): never
{
    $session = owned_session((int) $user->id, $sessionId);

    if (! $session->completed_at) {
        json_out(['message' => 'Quiz not yet completed.'], 422);
    }

    $q = db()->prepare('SELECT * FROM quiz_answers WHERE session_id = ?');
    $q->execute([$sessionId]);
    $answers = [];
    foreach ($q->fetchAll() as $a) {
        $answers[(int) $a->question_id] = $a;
    }

    $questions = present_questions(array_keys($answers), $sessionId);

    $out = [];
    foreach ($questions as $question) {
        $a = $answers[(int) $question->id] ?? null;
        $out[] = array_merge(question_payload($question), [
            'selected_choice' => $a && $a->selected_choice !== null ? (int) $a->selected_choice : null,
            'is_correct'      => $a && $a->is_correct !== null ? (bool) $a->is_correct : null,
        ]);
    }

    json_out([
        'session'   => session_payload($session),
        'questions' => $out,
    ]);
}

// ── POST /api/quizzes/{id}/cancel ──────────────────────────────────────────

function handle_quiz_cancel(object $user, int $sessionId): never
{
    $session = owned_session((int) $user->id, $sessionId);

    if (! $session->completed_at) {
        db()->prepare('DELETE FROM quiz_answers WHERE session_id = ?')->execute([$sessionId]);
        db()->prepare('DELETE FROM quiz_sessions WHERE id = ?')->execute([$sessionId]);
    }

    json_out(['ok' => true]);
}

// ── GET /api/quizzes/history ───────────────────────────────────────────────

function handle_quiz_history(object $user): never
{
    $page    = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = 15;
    $pdo = db();

    $q = $pdo->prepare('SELECT COUNT(*) FROM quiz_sessions WHERE student_id = ? AND completed_at IS NOT NULL');
    $q->execute([$user->id]);
    $total = (int) $q->fetchColumn();

    $offset = ($page - 1) * $perPage;
    $q = $pdo->prepare(
        'SELECT qs.*, subjects.code AS subject_code, subjects.name AS subject_name
         FROM quiz_sessions qs
         LEFT JOIN subjects ON subjects.id = qs.subject_id
         WHERE qs.student_id = ? AND qs.completed_at IS NOT NULL
         ORDER BY qs.completed_at DESC
         LIMIT ' . $perPage . ' OFFSET ' . $offset
    );
    $q->execute([$user->id]);

    json_out([
        'data'         => array_map('session_payload', $q->fetchAll()),
        'current_page' => $page,
        'last_page'    => max(1, (int) ceil($total / $perPage)),
        'total'        => $total,
    ]);
}

// ── Helpers (mirror the web controller's private methods) ─────────────────

function owned_session(int $studentId, int $sessionId): object
{
    $q = db()->prepare(
        'SELECT qs.*, subjects.code AS subject_code, subjects.name AS subject_name
         FROM quiz_sessions qs
         LEFT JOIN subjects ON subjects.id = qs.subject_id
         WHERE qs.id = ? AND qs.student_id = ? LIMIT 1'
    );
    $q->execute([$sessionId, $studentId]);
    $session = $q->fetch();
    if (! $session) {
        json_out(['message' => 'Not found.'], 404);
    }
    return $session;
}

function session_payload(object $s): array
{
    return [
        'id'              => (int) $s->id,
        'mode'            => $s->mode,
        'session_type'    => $s->session_type,
        'total_items'     => (int) $s->total_items,
        'correct_answers' => (int) $s->correct_answers,
        'score_percent'   => $s->score_percent,
        'duration_secs'   => $s->duration_secs !== null ? (int) $s->duration_secs : null,
        'started_at'      => $s->started_at,
        'completed_at'    => $s->completed_at,
        'subject_code'    => $s->subject_code ?? null,
        'subject_name'    => $s->subject_name ?? null,
    ];
}

function question_payload(object $q): array
{
    return [
        'id'            => (int) $q->id,
        'question_text' => $q->question_text,
        'question_type' => $q->question_type,
        'difficulty'    => $q->difficulty,
        'explanation'   => $q->explanation,
        'choices'       => array_map(fn ($c) => [
            'id'           => (int) $c->id,
            'choice_text'  => $c->choice_text,
            'choice_label' => $c->choice_label ?? null,
        ], $q->choices),
    ];
}

/** Load questions with their choices (and variants for paraphrasing). */
function fetch_questions(array $questionIds, bool $withVariants = false): array
{
    if (! $questionIds) {
        return [];
    }
    $pdo = db();
    $in = implode(',', array_map('intval', $questionIds));

    $questions = $pdo->query("SELECT * FROM questions WHERE id IN ($in)")->fetchAll();
    $choices   = $pdo->query("SELECT * FROM question_choices WHERE question_id IN ($in)")->fetchAll();
    $variants  = $withVariants
        ? $pdo->query("SELECT * FROM question_variants WHERE question_id IN ($in)")->fetchAll()
        : [];

    $byQuestion = [];
    foreach ($questions as $q) {
        $q->choices = [];
        $q->variants = [];
        $byQuestion[(int) $q->id] = $q;
    }
    foreach ($choices as $c) {
        $byQuestion[(int) $c->question_id]->choices[] = $c;
    }
    foreach ($variants as $v) {
        $byQuestion[(int) $v->question_id]->variants[] = $v;
    }

    return array_values($byQuestion);
}

/**
 * Deterministic per-session presentation: shuffle MCQ choices, relabel A-H,
 * paraphrase the stem, and order the questions — all seeded by the session id
 * so the quiz page and the results page always show identical wording.
 */
function present_questions(array $questionIds, int $sessionId): array
{
    $labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    $questions = fetch_questions($questionIds, true);

    foreach ($questions as $question) {
        $choices = $question->choices;
        if ($question->question_type !== 'true_false') {
            usort($choices, fn ($a, $b) =>
                crc32($sessionId . '-' . $question->id . '-' . $a->id)
                <=> crc32($sessionId . '-' . $question->id . '-' . $b->id));
        }
        foreach ($choices as $idx => $choice) {
            $choice->choice_label = $labels[$idx] ?? (string) ($idx + 1);
        }
        $question->choices = $choices;

        $question->question_text = para_for_display(
            $question,
            $question->variants,
            crc32($sessionId . '-text-' . $question->id),
            $question->question_type
        );
    }

    usort($questions, fn ($a, $b) =>
        crc32($sessionId . '-q-' . $a->id) <=> crc32($sessionId . '-q-' . $b->id));

    return $questions;
}

/** @return array{0:int[],1:?int} [questionIds, focusTopicId] */
function select_questions(string $mode, array $topicIds, int $studentId, int $count): array
{
    if (! $topicIds) {
        return [[], null];
    }
    $pdo = db();
    $topicsIn = implode(',', $topicIds);
    $base = "SELECT id FROM questions WHERE is_active = 1 AND topic_id IN ($topicsIn)";

    switch ($mode) {
        case 'topic':
            $focusTopicId = pick_focus_topic($topicIds, $studentId);
            $ids = $pdo->query("$base AND topic_id = " . (int) $focusTopicId . " ORDER BY RAND() LIMIT $count")
                ->fetchAll(PDO::FETCH_COLUMN);
            return [array_map('intval', $ids), $focusTopicId];

        case 'challenge':
            $hard = $pdo->query("$base AND difficulty IN ('difficult','moderate') ORDER BY RAND() LIMIT $count")
                ->fetchAll(PDO::FETCH_COLUMN);
            return [fill_questions(array_map('intval', $hard), $base, $count), null];

        case 'adaptive':
            $q = $pdo->prepare(
                "SELECT topic_id FROM performance_records
                 WHERE student_id = ? AND is_weak_area = 1 AND topic_id IN ($topicsIn)"
            );
            $q->execute([$studentId]);
            $weakTopicIds = array_map('intval', $q->fetchAll(PDO::FETCH_COLUMN));

            $weak = [];
            if ($weakTopicIds) {
                $weakIn = implode(',', $weakTopicIds);
                $weak = $pdo->query("$base AND topic_id IN ($weakIn) ORDER BY RAND() LIMIT $count")
                    ->fetchAll(PDO::FETCH_COLUMN);
            }
            return [fill_questions(array_map('intval', $weak), $base, $count), null];

        default: // timed & anything else: random spread
            $ids = $pdo->query("$base ORDER BY RAND() LIMIT $count")->fetchAll(PDO::FETCH_COLUMN);
            return [array_map('intval', $ids), null];
    }
}

/** Top up a partial selection with random extra questions until $target. */
function fill_questions(array $ids, string $baseSql, int $target): array
{
    if (count($ids) >= $target) {
        return array_slice($ids, 0, $target);
    }
    $sql = $baseSql;
    if ($ids) {
        $sql .= ' AND id NOT IN (' . implode(',', $ids) . ')';
    }
    $extra = db()->query($sql . ' ORDER BY RAND() LIMIT ' . ($target - count($ids)))
        ->fetchAll(PDO::FETCH_COLUMN);
    return array_merge($ids, array_map('intval', $extra));
}

function pick_focus_topic(array $topicIds, int $studentId): ?int
{
    $pdo = db();
    $topicsIn = implode(',', $topicIds);

    $q = $pdo->prepare(
        "SELECT topic_id FROM performance_records
         WHERE student_id = ? AND is_weak_area = 1 AND topic_id IN ($topicsIn)
         ORDER BY consecutive_wrong DESC LIMIT 1"
    );
    $q->execute([$studentId]);
    $weak = $q->fetchColumn();
    if ($weak) {
        return (int) $weak;
    }

    $topic = $pdo->query(
        "SELECT topic_id FROM questions WHERE is_active = 1 AND topic_id IN ($topicsIn)
         GROUP BY topic_id ORDER BY COUNT(*) DESC, RAND() LIMIT 1"
    )->fetchColumn();

    return $topic ? (int) $topic : (int) $topicIds[0];
}

/** Same accumulation rules as the web: totals, consecutive-wrong run, weak flag. */
function update_performance_records(int $studentId, array $topicTally): void
{
    $pdo = db();
    foreach ($topicTally as $topicId => $tally) {
        $q = $pdo->prepare('SELECT * FROM performance_records WHERE student_id = ? AND topic_id = ? LIMIT 1');
        $q->execute([$studentId, $topicId]);
        $record = $q->fetch();
        $wrong = $tally['attempts'] - $tally['correct'];

        if ($record) {
            $totalAttempts    = (int) $record->total_attempts + $tally['attempts'];
            $correctCount     = (int) $record->correct_count + $tally['correct'];
            $consecutiveWrong = $wrong === 0 ? 0 : (int) $record->consecutive_wrong + $wrong;
            [$isWeak] = weakness_evaluate((object) [
                'total_attempts'    => $totalAttempts,
                'correct_count'     => $correctCount,
                'consecutive_wrong' => $consecutiveWrong,
            ]);
            $pdo->prepare(
                'UPDATE performance_records
                 SET total_attempts = ?, correct_count = ?, consecutive_wrong = ?, is_weak_area = ?, last_attempted = ?
                 WHERE id = ?'
            )->execute([$totalAttempts, $correctCount, $consecutiveWrong, (int) $isWeak, now(), $record->id]);
        } else {
            [$isWeak] = weakness_evaluate((object) [
                'total_attempts'    => $tally['attempts'],
                'correct_count'     => $tally['correct'],
                'consecutive_wrong' => $wrong,
            ]);
            $pdo->prepare(
                'INSERT INTO performance_records
                 (student_id, topic_id, total_attempts, correct_count, consecutive_wrong, is_weak_area, last_attempted)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            )->execute([$studentId, $topicId, $tally['attempts'], $tally['correct'], $wrong, (int) $isWeak, now()]);
        }
    }
}

/** 10 points per correct answer, x1.5 in challenge mode — same as the web. */
function award_points(int $studentId, int $correctCount, string $mode): void
{
    $points = (int) round($correctCount * 10 * ($mode === 'challenge' ? 1.5 : 1.0));
    if ($points <= 0) {
        return;
    }
    db()->prepare(
        "INSERT INTO points_log (student_id, points, reason, created_at) VALUES (?, ?, 'quiz_completed', ?)"
    )->execute([$studentId, $points, now()]);
    db()->prepare('UPDATE student_profiles SET total_points = total_points + ? WHERE user_id = ?')
        ->execute([$points, $studentId]);
}
