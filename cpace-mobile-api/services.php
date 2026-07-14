<?php
/**
 * Business rules ported 1:1 from the CPACE web version's app/Services classes
 * (StreakService, WeaknessDetector, SpacedRepetitionScheduler, QuestionParaphraser)
 * so the mobile backend follows exactly the same process as the web.
 */

declare(strict_types=1);

// ── StreakService ───────────────────────────────────────────────────────────
// Consecutive calendar days ending today (or yesterday before today's first
// quiz) on which the student completed at least one quiz of any type.

function streak_dates(int $studentId): array
{
    $stmt = db()->prepare(
        'SELECT DISTINCT DATE(completed_at) AS d FROM quiz_sessions
         WHERE student_id = ? AND completed_at IS NOT NULL'
    );
    $stmt->execute([$studentId]);
    $active = array_flip(array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'd'));

    if (! $active) {
        return [];
    }

    $cursor = new DateTime('today');
    if (! isset($active[$cursor->format('Y-m-d')])) {
        $cursor->modify('-1 day');
    }

    $dates = [];
    while (isset($active[$cursor->format('Y-m-d')])) {
        $dates[] = $cursor->format('Y-m-d');
        $cursor->modify('-1 day');
    }

    return $dates;
}

function streak_current(int $studentId): int
{
    return count(streak_dates($studentId));
}

function streak_refresh(int $studentId): int
{
    $streak = streak_current($studentId);
    db()->prepare('UPDATE student_profiles SET streak_days = ? WHERE user_id = ?')
        ->execute([$streak, $studentId]);
    return $streak;
}

// ── WeaknessDetector ────────────────────────────────────────────────────────
// Weak when accuracy < 60% over >= 5 attempts, or 3+ consecutive wrong.

const WEAK_ACCURACY_THRESHOLD = 0.60;
const WEAK_MIN_ATTEMPTS       = 5;
const WEAK_CONSECUTIVE_WRONG  = 3;

/** @return array{0:bool,1:?string,2:float} [isWeak, reason, accuracy] */
function weakness_evaluate(object $record): array
{
    $attempts = (int) $record->total_attempts;
    $correct  = (int) $record->correct_count;
    $wrongRun = (int) $record->consecutive_wrong;
    $accuracy = $attempts > 0 ? $correct / $attempts : 0.0;

    if ($wrongRun >= WEAK_CONSECUTIVE_WRONG) {
        return [true, 'consecutive_wrong', $accuracy];
    }
    if ($attempts >= WEAK_MIN_ATTEMPTS && $accuracy < WEAK_ACCURACY_THRESHOLD) {
        return [true, 'low_accuracy', $accuracy];
    }
    return [false, null, $accuracy];
}

/** Open/resolve weakness_reports rows to match current performance. Idempotent. */
function weakness_sync(int $studentId, int $topicId): void
{
    $stmt = db()->prepare('SELECT * FROM performance_records WHERE student_id = ? AND topic_id = ? LIMIT 1');
    $stmt->execute([$studentId, $topicId]);
    $record = $stmt->fetch();
    if (! $record) {
        return;
    }

    [$isWeak, $reason, $accuracy] = weakness_evaluate($record);

    $stmt = db()->prepare(
        'SELECT * FROM weakness_reports
         WHERE student_id = ? AND topic_id = ? AND resolved_at IS NULL LIMIT 1'
    );
    $stmt->execute([$studentId, $topicId]);
    $open = $stmt->fetch();

    if ($isWeak && ! $open) {
        db()->prepare(
            'INSERT INTO weakness_reports (student_id, topic_id, flagged_at, trigger_reason, accuracy_at_flag)
             VALUES (?, ?, ?, ?, ?)'
        )->execute([$studentId, $topicId, now(), $reason, round($accuracy * 100, 2)]);
    } elseif (! $isWeak && $open) {
        db()->prepare('UPDATE weakness_reports SET resolved_at = ? WHERE id = ?')
            ->execute([now(), $open->id]);
    }
}

function weakness_sync_many(int $studentId, iterable $topicIds): void
{
    foreach ($topicIds as $topicId) {
        weakness_sync($studentId, (int) $topicId);
    }
}

// ── SpacedRepetitionScheduler (SM-2) ────────────────────────────────────────
// I(1)=1, I(2)=6, I(n)=round(I(n-1)*EF); EF' = EF + (0.1-(5-q)*(0.08+(5-q)*0.02)),
// floored at 1.3; quality < 3 is a lapse (chain resets, review tomorrow).

const SM2_EF_MIN     = 1.30;
const SM2_EF_DEFAULT = 2.50;

function sm2_quality(bool $correct, string $difficulty): int
{
    if ($correct) {
        return match ($difficulty) {
            'difficult' => 3,
            'moderate'  => 4,
            default     => 5, // easy
        };
    }
    return match ($difficulty) {
        'difficult' => 2,
        'moderate'  => 1,
        default     => 0,
    };
}

function sm2_next(array $state, int $quality, DateTime $reviewedOn): array
{
    $rep      = (int) ($state['repetition_num'] ?? 0);
    $ef       = (float) ($state['ease_factor'] ?? SM2_EF_DEFAULT);
    $interval = (int) ($state['interval_days'] ?? 0);

    $ef = $ef + (0.1 - (5 - $quality) * (0.08 + (5 - $quality) * 0.02));
    $ef = max(SM2_EF_MIN, round($ef, 2));

    if ($quality < 3) {
        $rep      = 0;
        $interval = 1;
    } else {
        $rep++;
        $interval = match (true) {
            $rep <= 1   => 1,
            $rep === 2  => 6,
            default     => max(1, (int) round($interval * $ef)),
        };
    }

    $next = (clone $reviewedOn)->modify("+{$interval} days");

    return [
        'repetition_num' => $rep,
        'ease_factor'    => $ef,
        'interval_days'  => $interval,
        'quality_score'  => $quality,
        'last_reviewed'  => $reviewedOn->format('Y-m-d'),
        'next_review_at' => $next->format('Y-m-d'),
    ];
}

/** Fast-forward a fresh item through N successful reviews (used for seeding). */
function sm2_mature(int $successes, int $quality = 4): array
{
    $state  = ['repetition_num' => 0, 'ease_factor' => SM2_EF_DEFAULT, 'interval_days' => 0];
    $anchor = new DateTime('2000-01-01');
    for ($i = 0; $i < max(0, $successes); $i++) {
        $state = sm2_next($state, $quality, $anchor);
    }
    return $state;
}

/** Upsert SM-2 state for a batch of graded answers. */
function sm2_record_answers(int $studentId, array $answers, ?DateTime $reviewedOn = null): void
{
    $reviewedOn ??= new DateTime('today');

    foreach ($answers as $answer) {
        $questionId = (int) $answer['question_id'];
        $quality    = sm2_quality((bool) $answer['correct'], (string) $answer['difficulty']);

        $stmt = db()->prepare('SELECT * FROM spaced_repetition_items WHERE student_id = ? AND question_id = ? LIMIT 1');
        $stmt->execute([$studentId, $questionId]);
        $existing = $stmt->fetch();

        $state = sm2_next([
            'repetition_num' => $existing->repetition_num ?? 0,
            'ease_factor'    => $existing->ease_factor ?? SM2_EF_DEFAULT,
            'interval_days'  => $existing->interval_days ?? 0,
        ], $quality, $reviewedOn);

        if ($existing) {
            db()->prepare(
                'UPDATE spaced_repetition_items
                 SET repetition_num = ?, ease_factor = ?, interval_days = ?, quality_score = ?, last_reviewed = ?, next_review_at = ?
                 WHERE id = ?'
            )->execute([
                $state['repetition_num'], $state['ease_factor'], $state['interval_days'],
                $state['quality_score'], $state['last_reviewed'], $state['next_review_at'],
                $existing->id,
            ]);
        } else {
            db()->prepare(
                'INSERT INTO spaced_repetition_items
                 (student_id, question_id, repetition_num, ease_factor, interval_days, quality_score, last_reviewed, next_review_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $studentId, $questionId,
                $state['repetition_num'], $state['ease_factor'], $state['interval_days'],
                $state['quality_score'], $state['last_reviewed'], $state['next_review_at'],
            ]);
        }
    }
}

// ── QuestionParaphraser ─────────────────────────────────────────────────────
// Meaning-preserving rewording, deterministic per session seed, so the same
// attempt always shows the same wording but retakes vary.

const PARA_SYNONYMS = [
    'is best described as'   => 'is best characterized as',
    'which of the following' => 'which of these',
    'all of the following'   => 'each of the following',
    'none of the following'  => 'not one of the following',
    'the entry to'           => 'the journal entry to',
    'is computed as'         => 'is calculated as',
    'arises when'            => 'occurs when',
    'results when'           => 'happens when',
    'in lieu of'             => 'instead of',
    'in accordance with'     => 'consistent with',
    'with respect to'        => 'regarding',
    'as part of'             => 'as a component of',
    'in a period of'         => 'during a period of',
    'for purposes of'        => 'for the purpose of',
    'is required to'         => 'must',
    'refers to'              => 'pertains to',
    'is treated'             => 'is handled',
    'is recognized'          => 'is recorded',
    'is measured at'         => 'is carried at',
    'is presented'           => 'is shown',
    'is classified as'       => 'is categorized as',
    'gives rise to'          => 'creates',
    'computed'      => 'calculated',
    'determine'     => 'identify',
    'yields'        => 'produces',
    'generally'     => 'typically',
    'primarily'     => 'mainly',
    'usually'       => 'ordinarily',
    'approximately' => 'roughly',
    'amount'        => 'sum',
    'entity'        => 'company',
    'firm'          => 'business',
    'permitted'     => 'allowed',
    'prohibited'    => 'not allowed',
    'appropriate'   => 'proper',
    'incurred'      => 'sustained',
    'subsequent'    => 'later',
];

const PARA_FRAMES = [
    '/^Which of the following (is|are|was|were) NOT\b/i' => [
        'Which of the following $1 NOT',
        'Which of these $1 NOT',
        'Identify which of the following $1 NOT',
        'Among the options below, which $1 NOT',
        'Of the following, which $1 NOT',
    ],
    '/^Which of the following\b/i' => [
        'Which of the following',
        'Which of these',
        'Among the following, which',
        'Identify which of the following',
        'Of the choices below, which',
    ],
    '/^Which\b/i' => [
        'Which',
        'Identify which',
        'Determine which',
    ],
    '/^What (is|are)\b/i' => [
        'What $1',
        'Identify what $1',
        'Determine what $1',
    ],
    '/^Under (the|a|an)\b/i' => [
        'Under $1',
        'Based on $1',
        'According to $1',
        'In line with $1',
    ],
    '/^How (is|are|does|do)\b/i' => [
        'How $1',
        'In what way $1',
    ],
    '/^An entity\b/i' => [
        'An entity',
        'A reporting entity',
        'A company',
    ],
];

function para_pick(int $seed, string $salt, int $n): int
{
    if ($n <= 0) {
        return 0;
    }
    return (crc32($seed . '|' . $salt) % $n + $n) % $n;
}

function para_rephrase(string $text, int $seed, string $type = 'mcq'): string
{
    $text = trim($text);

    // frame
    foreach (PARA_FRAMES as $pattern => $options) {
        if (preg_match($pattern, $text)) {
            $choice = $options[para_pick($seed, 'frame', count($options))];
            $text = preg_replace($pattern, $choice, $text, 1);
            break;
        }
    }

    // synonyms (seed toggles each swap independently)
    $i = 0;
    foreach (PARA_SYNONYMS as $from => $to) {
        $i++;
        if (para_pick($seed, 'syn' . $i, 2) === 0) {
            continue;
        }
        $text = preg_replace('/\b' . preg_quote($from, '/') . '\b/i', $to, $text, 1);
    }

    // neutral prefix for statements / true-false
    $isStatement = str_ends_with($text, ':');
    $startsInterrogative = (bool) preg_match('/^(Which|What|How|When|Why|Where|Identify|Among|Of|Determine)\b/i', $text);

    if ($type === 'true_false') {
        $options = ['', 'True or False: ', 'Evaluate this statement: ', 'State whether this is true or false: '];
    } elseif ($isStatement && ! $startsInterrogative) {
        $options = ['', 'Complete the statement: ', 'Choose the option that best completes: ', 'Fill in the blank: '];
    } else {
        return $text;
    }

    $prefix = $options[para_pick($seed, 'pre', count($options))];
    return $prefix === '' ? $text : $prefix . $text;
}

/** Pick display wording: stored variants (faculty/AI) if any, else rule-based. */
function para_for_display(object $question, array $variants, int $seed, string $type = 'mcq'): string
{
    $original = trim($question->question_text);

    $stored = array_values(array_filter(array_map(
        fn ($v) => (bool) $v->is_active ? $v->variant_text : null,
        $variants
    )));

    if ($stored) {
        $pool = array_values(array_filter(array_merge([$original], $stored)));
        return $pool[para_pick($seed, 'variant', count($pool))];
    }

    return para_rephrase($original, $seed, $type);
}
