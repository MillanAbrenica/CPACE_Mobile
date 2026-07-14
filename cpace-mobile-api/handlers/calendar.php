<?php
/** Spaced-repetition calendar — same process as the web API's CalendarApiController. */

declare(strict_types=1);

const SUBJECT_PALETTE = [
    1 => ['#e9f1fd', '#3b7ddd'],
    2 => ['#eaf0fb', '#2f63c4'],
    3 => ['#fef3e2', '#e8910b'],
    4 => ['#e8f7ee', '#21a366'],
    5 => ['#fdeaea', '#c0392b'],
    6 => ['#f0eafb', '#8e5bd0'],
];

function handle_calendar(object $user): never
{
    $studentId = (int) $user->id;
    $today = new DateTime('today');

    ensure_schedule($studentId);

    $monthParam = (string) ($_GET['month'] ?? '');
    $cursor = preg_match('/^\d{4}-\d{2}$/', $monthParam)
        ? new DateTime($monthParam . '-01')
        : new DateTime($today->format('Y-m-01'));

    $topicMeta = topic_meta($studentId);

    $q = db()->prepare(
        'SELECT sr.next_review_at, q.topic_id, t.name AS topic, s.code AS subject_code, s.id AS subject_id
         FROM spaced_repetition_items sr
         JOIN questions q ON q.id = sr.question_id
         JOIN topics t ON t.id = q.topic_id
         JOIN subjects s ON s.id = t.subject_id
         WHERE sr.student_id = ?'
    );
    $q->execute([$studentId]);
    $items = $q->fetchAll();

    $byDate = [];
    foreach ($items as $it) {
        $date = date('Y-m-d', strtotime($it->next_review_at));
        $key = (int) $it->topic_id;
        if (! isset($byDate[$date][$key])) {
            $byDate[$date][$key] = make_event($it, $topicMeta);
        }
        $byDate[$date][$key]['count']++;
    }

    // Month grid: weeks run Sunday..Saturday, padded to full weeks.
    $gridStart = clone $cursor;
    $gridStart->modify('-' . (int) $gridStart->format('w') . ' days'); // back to Sunday
    $gridEnd = new DateTime($cursor->format('Y-m-t'));
    $gridEnd->modify('+' . (6 - (int) $gridEnd->format('w')) . ' days'); // forward to Saturday

    $weeks = [];
    $day = clone $gridStart;
    while ($day <= $gridEnd) {
        $week = [];
        for ($i = 0; $i < 7; $i++) {
            $ds = $day->format('Y-m-d');
            $events = array_values($byDate[$ds] ?? []);
            usort($events, fn ($a, $b) => $b['priority_rank'] <=> $a['priority_rank']);
            $week[] = [
                'day'      => (int) $day->format('j'),
                'date'     => $ds,
                'muted'    => $day->format('n') !== $cursor->format('n'),
                'is_today' => $ds === $today->format('Y-m-d'),
                'events'   => $events,
            ];
            $day->modify('+1 day');
        }
        $weeks[] = $week;
    }

    // Today's due reviews (today + overdue), aggregated per topic
    $dueByTopic = [];
    foreach ($byDate as $date => $topics) {
        if ($date > $today->format('Y-m-d')) {
            continue;
        }
        foreach ($topics as $topicId => $event) {
            if (! isset($dueByTopic[$topicId])) {
                $dueByTopic[$topicId] = $event;
                $dueByTopic[$topicId]['count'] = 0;
            }
            $dueByTopic[$topicId]['count'] += $event['count'];
        }
    }
    $todayReviews = array_values($dueByTopic);
    usort($todayReviews, fn ($a, $b) => $b['priority_rank'] <=> $a['priority_rank']);

    // Upcoming 7 days
    $upcoming = [];
    for ($i = 1; $i <= 7; $i++) {
        $date = (clone $today)->modify("+{$i} days");
        $ds = $date->format('Y-m-d');
        foreach (($byDate[$ds] ?? []) as $event) {
            $event['date_label'] = $date->format('M j');
            $upcoming[] = $event;
        }
    }

    json_out([
        'month_label'   => $cursor->format('F Y'),
        'prev_month'    => (clone $cursor)->modify('-1 month')->format('Y-m'),
        'next_month'    => (clone $cursor)->modify('+1 month')->format('Y-m'),
        'weeks'         => $weeks,
        'today_reviews' => $todayReviews,
        'upcoming'      => array_slice($upcoming, 0, 6),
        'due_count'     => array_sum(array_column($todayReviews, 'count')),
        'has_data'      => count($items) > 0,
    ]);
}

function make_event(object $it, array $topicMeta): array
{
    $meta   = $topicMeta[(int) $it->topic_id] ?? null;
    $isWeak = (bool) ($meta['is_weak'] ?? false);
    $acc    = $meta['accuracy'] ?? null;
    [$bg, $dot] = SUBJECT_PALETTE[(int) $it->subject_id] ?? ['#eef0f2', '#7a7a7a'];

    if ($isWeak) {
        $priority = 'High';
        $rank = 3;
    } elseif ($acc !== null && $acc < 75) {
        $priority = 'Medium';
        $rank = 2;
    } else {
        $priority = 'Low';
        $rank = 1;
    }

    return [
        'topic'         => $it->topic,
        'subject_code'  => $it->subject_code,
        'subject_id'    => (int) $it->subject_id,
        'count'         => 0,
        'priority'      => $priority,
        'priority_rank' => $rank,
        'is_weak'       => $isWeak,
        'bg'            => $bg,
        'dot'           => $dot,
    ];
}

function topic_meta(int $studentId): array
{
    $q = db()->prepare(
        'SELECT pr.topic_id, pr.correct_count, pr.total_attempts, pr.consecutive_wrong,
                t.name AS topic, s.code AS subject_code, s.id AS subject_id
         FROM performance_records pr
         JOIN topics t ON t.id = pr.topic_id
         JOIN subjects s ON s.id = t.subject_id
         WHERE pr.student_id = ?'
    );
    $q->execute([$studentId]);

    $meta = [];
    foreach ($q->fetchAll() as $r) {
        [$isWeak] = weakness_evaluate($r);
        $meta[(int) $r->topic_id] = [
            'topic'        => $r->topic,
            'subject_code' => $r->subject_code,
            'subject_id'   => (int) $r->subject_id,
            'accuracy'     => $r->total_attempts > 0 ? (int) round($r->correct_count / $r->total_attempts * 100) : null,
            'is_weak'      => $isWeak,
        ];
    }
    return $meta;
}

/**
 * Sync weakness flags and, for a student with performance history but no
 * spaced-repetition rows yet, seed a realistic SM-2 schedule from their
 * historical accuracy — the same bootstrap the web version performs.
 */
function ensure_schedule(int $studentId): void
{
    $pdo = db();

    $q = $pdo->prepare('SELECT * FROM performance_records WHERE student_id = ? AND total_attempts > 0');
    $q->execute([$studentId]);
    $records = $q->fetchAll();

    foreach ($records as $record) {
        weakness_sync($studentId, (int) $record->topic_id);
    }

    $q = $pdo->prepare('SELECT COUNT(*) FROM spaced_repetition_items WHERE student_id = ?');
    $q->execute([$studentId]);
    if ((int) $q->fetchColumn() > 0 || ! $records) {
        return;
    }

    $rows = [];
    foreach ($records as $record) {
        $accuracy   = $record->correct_count / max((int) $record->total_attempts, 1);
        $reviewedOn = new DateTime($record->last_attempted ?: 'now');

        $q = $pdo->prepare('SELECT id, difficulty FROM questions WHERE topic_id = ? AND is_active = 1 ORDER BY id');
        $q->execute([$record->topic_id]);
        $questions = $q->fetchAll();
        if (! $questions) {
            continue;
        }

        $rememberCount = (int) round($accuracy * count($questions));
        foreach (array_values($questions) as $i => $question) {
            $state = $i < $rememberCount
                ? sm2_mature(1 + ($i % 4), sm2_quality(true, $question->difficulty))
                : sm2_next(
                    ['repetition_num' => 0, 'ease_factor' => SM2_EF_DEFAULT, 'interval_days' => 0],
                    sm2_quality(false, $question->difficulty),
                    $reviewedOn
                );

            $interval = (int) $state['interval_days'];
            $rows[] = [
                $studentId, (int) $question->id,
                $state['repetition_num'], $state['ease_factor'], $interval,
                $state['quality_score'] ?? null,
                $reviewedOn->format('Y-m-d'),
                (clone $reviewedOn)->modify("+{$interval} days")->format('Y-m-d'),
            ];
        }
    }

    $ins = $pdo->prepare(
        'INSERT INTO spaced_repetition_items
         (student_id, question_id, repetition_num, ease_factor, interval_days, quality_score, last_reviewed, next_review_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    foreach ($rows as $row) {
        $ins->execute($row);
    }
}
