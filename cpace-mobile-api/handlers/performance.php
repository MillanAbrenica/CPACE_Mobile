<?php
/** Performance analytics — same computations as the web API's PerformanceApiController. */

declare(strict_types=1);

function handle_performance(object $user): never
{
    $studentId = (int) $user->id;
    $pdo = db();

    $sumWindow = function (?string $from = null, ?string $to = null) use ($pdo, $studentId): array {
        $sql = "SELECT COALESCE(SUM(total_items),0) attempted,
                       COALESCE(SUM(correct_answers),0) correct,
                       COALESCE(SUM(duration_secs),0) duration
                FROM quiz_sessions
                WHERE student_id = ? AND session_type != 'training' AND completed_at IS NOT NULL";
        $params = [$studentId];
        if ($from) { $sql .= ' AND started_at >= ?'; $params[] = $from; }
        if ($to)   { $sql .= ' AND started_at < ?';  $params[] = $to; }
        $q = $pdo->prepare($sql);
        $q->execute($params);
        $r = $q->fetch();
        return ['attempted' => (int) $r->attempted, 'correct' => (int) $r->correct, 'duration' => (int) $r->duration];
    };

    $weekStart = date('Y-m-d H:i:s', strtotime('-7 days'));
    $prevStart = date('Y-m-d H:i:s', strtotime('-14 days'));

    $all  = $sumWindow();
    $week = $sumWindow($weekStart, null);
    $prev = $sumWindow($prevStart, $weekStart);

    $totalAttempted  = $all['attempted'];
    $totalCorrect    = $all['correct'];
    $overallAccuracy = $totalAttempted > 0 ? (int) round($totalCorrect / $totalAttempted * 100) : 0;

    $accThisWeek = $week['attempted'] > 0 ? (int) round($week['correct'] / $week['attempted'] * 100) : 0;
    $accPrevWeek = $prev['attempted'] > 0 ? (int) round($prev['correct'] / $prev['attempted'] * 100) : 0;

    $stats = [
        'accuracy'        => $overallAccuracy,
        'accuracy_delta'  => $accThisWeek - $accPrevWeek,
        'attempted'       => $totalAttempted,
        'attempted_delta' => $week['attempted'] - $prev['attempted'],
        'correct'         => $totalCorrect,
        'correct_delta'   => $week['correct'] - $prev['correct'],
        'wrong'           => max(0, $totalAttempted - $totalCorrect),
        'avg_secs'        => $totalAttempted > 0 ? (int) round($all['duration'] / $totalAttempted) : 0,
    ];

    // 7-day daily accuracy series
    $dailySeries = [];
    $daily = $pdo->prepare(
        "SELECT COALESCE(SUM(total_items),0) att, COALESCE(SUM(correct_answers),0) cor
         FROM quiz_sessions
         WHERE student_id = ? AND session_type != 'training' AND completed_at IS NOT NULL
           AND started_at >= ? AND started_at < ?"
    );
    for ($i = 6; $i >= 0; $i--) {
        $day  = new DateTime("today -{$i} days");
        $next = (clone $day)->modify('+1 day');
        $daily->execute([$studentId, $day->format('Y-m-d H:i:s'), $next->format('Y-m-d H:i:s')]);
        $r = $daily->fetch();
        $dailySeries[] = [
            'label'    => $day->format('M j'),
            'accuracy' => $r->att > 0 ? (int) round($r->cor / $r->att * 100) : 0,
            'has_data' => $r->att > 0,
        ];
    }

    // Per-topic stats with the shared weakness rules
    $q = $pdo->prepare(
        'SELECT topics.name AS topic, subjects.code AS subject_code,
                pr.correct_count, pr.total_attempts, pr.consecutive_wrong
         FROM performance_records pr
         JOIN topics ON topics.id = pr.topic_id
         JOIN subjects ON subjects.id = topics.subject_id
         WHERE pr.student_id = ? AND pr.total_attempts > 0'
    );
    $q->execute([$studentId]);

    $topicStats = [];
    foreach ($q->fetchAll() as $r) {
        [$isWeak] = weakness_evaluate($r);
        $topicStats[] = [
            'topic'        => $r->topic,
            'subject_code' => $r->subject_code,
            'correct'      => (int) $r->correct_count,
            'attempts'     => (int) $r->total_attempts,
            'accuracy'     => $r->total_attempts > 0 ? (int) round($r->correct_count / $r->total_attempts * 100) : 0,
            'is_weak'      => $isWeak,
        ];
    }

    $strengths = array_values(array_filter($topicStats, fn ($t) => $t['attempts'] >= WEAK_MIN_ATTEMPTS && $t['accuracy'] >= 75));
    usort($strengths, fn ($a, $b) => $b['accuracy'] <=> $a['accuracy']);

    $weaknesses = array_values(array_filter($topicStats, fn ($t) => $t['is_weak']));
    usort($weaknesses, fn ($a, $b) => $a['accuracy'] <=> $b['accuracy']);

    // Per-subject accuracy
    $q = $pdo->prepare(
        'SELECT subjects.code, subjects.name, subjects.color,
                COALESCE(SUM(pr.correct_count),0) AS correct,
                COALESCE(SUM(pr.total_attempts),0) AS attempts
         FROM subjects
         LEFT JOIN topics ON topics.subject_id = subjects.id
         LEFT JOIN performance_records pr ON pr.topic_id = topics.id AND pr.student_id = ?
         GROUP BY subjects.id, subjects.code, subjects.name, subjects.color
         ORDER BY subjects.id'
    );
    $q->execute([$studentId]);
    $subjectAccuracy = array_map(fn ($r) => [
        'code'     => $r->code,
        'name'     => $r->name,
        'color'    => $r->color,
        'accuracy' => $r->attempts > 0 ? (int) round($r->correct / $r->attempts * 100) : 0,
    ], $q->fetchAll());

    // By quiz mode
    $q = $pdo->prepare(
        "SELECT mode, COUNT(*) AS sessions,
                COALESCE(SUM(total_items),0) AS attempted,
                COALESCE(SUM(correct_answers),0) AS correct
         FROM quiz_sessions
         WHERE student_id = ? AND session_type != 'training' AND completed_at IS NOT NULL
         GROUP BY mode"
    );
    $q->execute([$studentId]);
    $byMode = [];
    foreach ($q->fetchAll() as $r) {
        $byMode[$r->mode] = $r;
    }

    $byQuizType = [];
    foreach (['adaptive' => 'Adaptive', 'topic' => 'Topic', 'timed' => 'Timed', 'challenge' => 'Challenge'] as $mode => $label) {
        $att = (int) ($byMode[$mode]->attempted ?? 0);
        $cor = (int) ($byMode[$mode]->correct ?? 0);
        $byQuizType[] = [
            'mode'      => $mode,
            'label'     => $label,
            'sessions'  => (int) ($byMode[$mode]->sessions ?? 0),
            'attempted' => $att,
            'correct'   => $cor,
            'accuracy'  => $att > 0 ? (int) round($cor / $att * 100) : 0,
        ];
    }

    json_out([
        'stats'            => $stats,
        'streak_days'      => streak_current($studentId),
        'daily_series'     => $dailySeries,
        'strengths'        => $strengths,
        'weaknesses'       => $weaknesses,
        'subject_accuracy' => $subjectAccuracy,
        'by_quiz_type'     => $byQuizType,
    ]);
}
