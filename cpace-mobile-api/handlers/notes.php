<?php
/** Review notes CRUD — same behavior as the web API's ReviewNoteApiController. */

declare(strict_types=1);

function handle_notes_index(object $user): never
{
    $studentId = (int) $user->id;
    $pdo = db();

    $search  = trim((string) ($_GET['q'] ?? ''));
    $subject = $_GET['subject'] ?? null;
    $sort    = $_GET['sort'] ?? 'recent';
    $filter  = $_GET['filter'] ?? null;
    $page    = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = 15;

    $where  = 'student_id = ?';
    $params = [$studentId];

    if ($search !== '') {
        $where .= ' AND (title LIKE ? OR tags LIKE ? OR content LIKE ?)';
        $like = "%{$search}%";
        array_push($params, $like, $like, $like);
    }
    if ($subject !== null && $subject !== '' && is_numeric($subject)) {
        $where .= ' AND subject_id = ?';
        $params[] = (int) $subject;
    }
    if ($filter === 'favorites') {
        $where .= ' AND is_favorite = 1';
    }

    $order = match ($sort) {
        'oldest'   => 'created_at ASC',
        'az'       => 'title ASC',
        'reviewed' => 'last_reviewed_at DESC',
        default    => 'created_at DESC',
    };

    $q = $pdo->prepare("SELECT COUNT(*) FROM review_notes WHERE $where");
    $q->execute($params);
    $total = (int) $q->fetchColumn();

    $offset = ($page - 1) * $perPage;
    $q = $pdo->prepare("SELECT * FROM review_notes WHERE $where ORDER BY $order LIMIT $perPage OFFSET $offset");
    $q->execute($params);
    $notes = $q->fetchAll();

    // stats
    $q = $pdo->prepare('SELECT COUNT(*) FROM review_notes WHERE student_id = ?');
    $q->execute([$studentId]);
    $totalNotes = (int) $q->fetchColumn();

    $q = $pdo->prepare('SELECT COUNT(*) FROM review_notes WHERE student_id = ? AND created_at >= ?');
    $q->execute([$studentId, date('Y-m-d H:i:s', strtotime('-7 days'))]);
    $notesThisWeek = (int) $q->fetchColumn();

    $q = $pdo->prepare('SELECT COUNT(DISTINCT subject_id) FROM review_notes WHERE student_id = ? AND subject_id IS NOT NULL');
    $q->execute([$studentId]);
    $subjectsCovered = (int) $q->fetchColumn();

    $subjects = $pdo->query('SELECT id, code, name FROM subjects ORDER BY id')->fetchAll();
    $topics   = $pdo->query('SELECT id, subject_id, name FROM topics ORDER BY subject_id, name')->fetchAll();

    json_out([
        'data'         => array_map('present_note', $notes),
        'current_page' => $page,
        'last_page'    => max(1, (int) ceil($total / $perPage)),
        'total'        => $total,
        'stats'        => ['total' => $totalNotes, 'this_week' => $notesThisWeek, 'subjects' => $subjectsCovered],
        'subjects'     => $subjects,
        'topics'       => $topics,
    ]);
}

function handle_notes_store(object $user): never
{
    $data = validate_note(body());
    $pdo = db();

    $pdo->prepare(
        'INSERT INTO review_notes (student_id, subject_id, topic_id, title, content, tags, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $user->id, $data['subject_id'], $data['topic_id'],
        $data['title'], $data['content'], $data['tags'], now(), now(),
    ]);

    json_out(['ok' => true, 'note' => present_note(find_note((int) $pdo->lastInsertId(), (int) $user->id))], 201);
}

function handle_notes_show(object $user, int $noteId): never
{
    $note = find_note($noteId, (int) $user->id);

    if (($_GET['read'] ?? '') === '1' || ($_GET['read'] ?? '') === 'true') {
        db()->prepare('UPDATE review_notes SET review_count = review_count + 1, last_reviewed_at = ? WHERE id = ?')
            ->execute([now(), $noteId]);
        $note = find_note($noteId, (int) $user->id);
    }

    json_out(['ok' => true, 'note' => present_note($note)]);
}

function handle_notes_update(object $user, int $noteId): never
{
    find_note($noteId, (int) $user->id); // ownership check
    $data = validate_note(body());

    db()->prepare(
        'UPDATE review_notes SET title = ?, content = ?, subject_id = ?, topic_id = ?, tags = ?, updated_at = ?
         WHERE id = ?'
    )->execute([$data['title'], $data['content'], $data['subject_id'], $data['topic_id'], $data['tags'], now(), $noteId]);

    json_out(['ok' => true, 'note' => present_note(find_note($noteId, (int) $user->id))]);
}

function handle_notes_destroy(object $user, int $noteId): never
{
    find_note($noteId, (int) $user->id);
    db()->prepare('DELETE FROM review_notes WHERE id = ?')->execute([$noteId]);
    json_out(['ok' => true]);
}

function handle_notes_favorite(object $user, int $noteId): never
{
    $note = find_note($noteId, (int) $user->id);
    $new = ! (bool) $note->is_favorite;
    db()->prepare('UPDATE review_notes SET is_favorite = ? WHERE id = ?')->execute([(int) $new, $noteId]);
    json_out(['ok' => true, 'is_favorite' => $new]);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function find_note(int $noteId, int $studentId): object
{
    $q = db()->prepare('SELECT * FROM review_notes WHERE id = ? LIMIT 1');
    $q->execute([$noteId]);
    $note = $q->fetch();
    if (! $note) {
        json_out(['message' => 'Not found.'], 404);
    }
    if ((int) $note->student_id !== $studentId) {
        json_out(['message' => 'Forbidden.'], 403);
    }
    return $note;
}

function validate_note(array $data): array
{
    $title = trim((string) ($data['title'] ?? ''));
    if ($title === '' || mb_strlen($title) > 180) {
        validation_error(['title' => ['The title field is required.']]);
    }

    $subjectId = isset($data['subject_id']) && is_numeric($data['subject_id']) ? (int) $data['subject_id'] : null;
    if ($subjectId !== null) {
        $q = db()->prepare('SELECT id FROM subjects WHERE id = ?');
        $q->execute([$subjectId]);
        if (! $q->fetch()) $subjectId = null;
    }

    $topicId = isset($data['topic_id']) && is_numeric($data['topic_id']) ? (int) $data['topic_id'] : null;
    if ($topicId !== null) {
        $q = db()->prepare('SELECT id FROM topics WHERE id = ?');
        $q->execute([$topicId]);
        if (! $q->fetch()) $topicId = null;
    }

    $tags = isset($data['tags']) ? trim((string) $data['tags']) : null;
    if ($tags) {
        $tags = implode(', ', array_filter(array_map('trim', explode(',', $tags))));
    }

    return [
        'title'      => $title,
        'content'    => $data['content'] ?? null,
        'subject_id' => $subjectId,
        'topic_id'   => $topicId,
        'tags'       => $tags ?: null,
    ];
}

function present_note(object $note): array
{
    static $subjectCodes = null, $topicNames = null;
    if ($subjectCodes === null) {
        $subjectCodes = db()->query('SELECT id, code FROM subjects')->fetchAll(PDO::FETCH_KEY_PAIR);
        $topicNames   = db()->query('SELECT id, name FROM topics')->fetchAll(PDO::FETCH_KEY_PAIR);
    }

    $tagList = $note->tags
        ? array_values(array_filter(array_map('trim', explode(',', $note->tags))))
        : [];

    return [
        'id'            => (int) $note->id,
        'title'         => $note->title,
        'content'       => $note->content,
        'subject_id'    => $note->subject_id !== null ? (int) $note->subject_id : null,
        'subject_code'  => $note->subject_id !== null ? ($subjectCodes[(int) $note->subject_id] ?? null) : null,
        'topic_id'      => $note->topic_id !== null ? (int) $note->topic_id : null,
        'topic_name'    => $note->topic_id !== null ? ($topicNames[(int) $note->topic_id] ?? null) : null,
        'tags'          => $note->tags,
        'tag_list'      => $tagList,
        'is_favorite'   => (bool) $note->is_favorite,
        'review_count'  => (int) $note->review_count,
        'last_reviewed' => $note->last_reviewed_at ? date('M j, Y', strtotime($note->last_reviewed_at)) : null,
        'created_on'    => $note->created_at ? date('M j, Y', strtotime($note->created_at)) : null,
    ];
}
