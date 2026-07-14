<?php
/** Dashboard endpoint — same queries as the web API's DashboardApiController. */

declare(strict_types=1);

function handle_dashboard(object $user): never
{
    $studentId = (int) $user->id;
    $pdo = db();

    $stmt = $pdo->prepare('SELECT * FROM student_profiles WHERE user_id = ? LIMIT 1');
    $stmt->execute([$studentId]);
    $profile = $stmt->fetch() ?: null;

    $streak   = streak_current($studentId);
    $points   = (int) ($profile->total_points ?? 0);
    $examDate = $profile->exam_target_date ?? null;
    $daysToExam = null;
    if ($examDate) {
        $diff = strtotime($examDate . ' 00:00:00') - strtotime(date('Y-m-d') . ' 00:00:00');
        $daysToExam = max(0, (int) ceil($diff / 86400));
    }

    $weekAgo = date('Y-m-d H:i:s', strtotime('-7 days'));

    $q = $pdo->prepare(
        "SELECT COALESCE(SUM(total_items),0) FROM quiz_sessions
         WHERE student_id = ? AND session_type != 'training' AND completed_at IS NOT NULL"
    );
    $q->execute([$studentId]);
    $questionsAttempted = (int) $q->fetchColumn();

    $q = $pdo->prepare(
        "SELECT COALESCE(SUM(total_items),0) FROM quiz_sessions
         WHERE student_id = ? AND session_type != 'training' AND completed_at IS NOT NULL AND started_at >= ?"
    );
    $q->execute([$studentId, $weekAgo]);
    $questionsThisWeek = (int) $q->fetchColumn();

    $q = $pdo->prepare(
        "SELECT COALESCE(SUM(duration_secs),0) FROM quiz_sessions
         WHERE student_id = ? AND session_type != 'training'"
    );
    $q->execute([$studentId]);
    $studySeconds = (int) $q->fetchColumn();

    $q = $pdo->prepare(
        "SELECT COALESCE(SUM(duration_secs),0) FROM quiz_sessions
         WHERE student_id = ? AND session_type != 'training' AND started_at >= ?"
    );
    $q->execute([$studentId, $weekAgo]);
    $studySecondsWeek = (int) $q->fetchColumn();

    $q = $pdo->prepare(
        'SELECT COALESCE(SUM(correct_count),0) c, COALESCE(SUM(total_attempts),0) t
         FROM performance_records WHERE student_id = ?'
    );
    $q->execute([$studentId]);
    $agg = $q->fetch();
    $readiness = ($agg && $agg->t > 0) ? (int) round($agg->c / $agg->t * 100) : 0;

    $q = $pdo->prepare(
        'SELECT subjects.id, subjects.code, subjects.name, subjects.color,
                COALESCE(SUM(pr.correct_count),0) AS correct,
                COALESCE(SUM(pr.total_attempts),0) AS attempts
         FROM subjects
         LEFT JOIN topics ON topics.subject_id = subjects.id
         LEFT JOIN performance_records pr ON pr.topic_id = topics.id AND pr.student_id = ?
         GROUP BY subjects.id, subjects.code, subjects.name, subjects.color
         ORDER BY subjects.id'
    );
    $q->execute([$studentId]);
    $subjectMastery = array_map(fn ($row) => [
        'id'      => (int) $row->id,
        'code'    => $row->code,
        'name'    => $row->name,
        'color'   => $row->color,
        'mastery' => $row->attempts > 0 ? (int) round($row->correct / $row->attempts * 100) : 0,
    ], $q->fetchAll());

    $q = $pdo->prepare(
        'SELECT topics.name AS topic, subjects.code AS subject_code, pr.accuracy_rate
         FROM performance_records pr
         JOIN topics ON topics.id = pr.topic_id
         JOIN subjects ON subjects.id = topics.subject_id
         WHERE pr.student_id = ? AND pr.total_attempts > 0
         ORDER BY pr.accuracy_rate ASC, pr.total_attempts DESC
         LIMIT 3'
    );
    $q->execute([$studentId]);
    $weaknesses = $q->fetchAll();

    $q = $pdo->prepare(
        "SELECT qs.id, qs.mode, qs.session_type, qs.total_items, qs.correct_answers,
                qs.score_percent, qs.started_at, qs.completed_at, subjects.code AS subject_code
         FROM quiz_sessions qs
         LEFT JOIN subjects ON subjects.id = qs.subject_id
         WHERE qs.student_id = ? AND qs.session_type != 'training'
         ORDER BY qs.started_at DESC
         LIMIT 5"
    );
    $q->execute([$studentId]);
    $recentActivity = $q->fetchAll();

    $q = $pdo->prepare('SELECT COUNT(*) FROM notifications WHERE recipient_id = ? AND is_read = 0');
    $q->execute([$studentId]);
    $unreadNotifications = (int) $q->fetchColumn();

    json_out([
        'streak'               => $streak,
        'points'               => $points,
        'days_to_exam'         => $daysToExam,
        'questions_attempted'  => $questionsAttempted,
        'questions_this_week'  => $questionsThisWeek,
        'study_hours'          => (int) round($studySeconds / 3600),
        'study_hours_week'     => (int) round($studySecondsWeek / 3600),
        'readiness'            => $readiness,
        'subject_mastery'      => $subjectMastery,
        'weaknesses'           => $weaknesses,
        'recent_activity'      => $recentActivity,
        'unread_notifications' => $unreadNotifications,
    ]);
}

/** Subjects list — mirrors the web API's SubjectsApiController. */
function handle_subjects(object $user): never
{
    $studentId = (int) $user->id;
    $pdo = db();

    $subjects = $pdo->query('SELECT * FROM subjects WHERE is_active = 1 ORDER BY id')->fetchAll();

    $out = [];
    foreach ($subjects as $subject) {
        $q = $pdo->prepare(
            'SELECT COUNT(*) FROM questions
             WHERE is_active = 1 AND topic_id IN (SELECT id FROM topics WHERE subject_id = ?)'
        );
        $q->execute([$subject->id]);
        $questionCount = (int) $q->fetchColumn();

        $q = $pdo->prepare(
            'SELECT COALESCE(SUM(correct_count),0) c, COALESCE(SUM(total_attempts),0) t
             FROM performance_records
             WHERE student_id = ? AND topic_id IN (SELECT id FROM topics WHERE subject_id = ?)'
        );
        $q->execute([$studentId, $subject->id]);
        $perf = $q->fetch();

        $out[] = [
            'id'             => (int) $subject->id,
            'code'           => $subject->code,
            'name'           => $subject->name,
            'description'    => $subject->description,
            'color'          => $subject->color,
            'icon'           => $subject->icon,
            'question_count' => $questionCount,
            'mastery'        => ($perf && $perf->t > 0) ? (int) round($perf->c / $perf->t * 100) : 0,
        ];
    }

    json_out(['subjects' => $out]);
}
