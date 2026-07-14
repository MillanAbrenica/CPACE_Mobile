<?php
/**
 * CPACE Mobile API — front controller.
 *
 * Standalone PHP backend for the CPACE_Mobile app. Same routes as the CPACE
 * web version's routes/api.php, same database (cpace_db), same business rules
 * — but an independent codebase owned by the mobile project.
 *
 * Run with XAMPP's PHP:   php -S 0.0.0.0:8080 index.php   (or start-api.bat)
 */

declare(strict_types=1);

require __DIR__ . '/config.php';
require __DIR__ . '/helpers.php';
require __DIR__ . '/services.php';
require __DIR__ . '/handlers/auth.php';
require __DIR__ . '/handlers/dashboard.php';
require __DIR__ . '/handlers/quiz.php';
require __DIR__ . '/handlers/performance.php';
require __DIR__ . '/handlers/notes.php';
require __DIR__ . '/handlers/calendar.php';

// CORS (needed when the app runs in Expo Web; harmless for native)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path   = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path   = rtrim($path, '/') ?: '/';

try {
    route($method, $path);
} catch (Throwable $e) {
    error_log($e->getMessage());
    json_out(['message' => 'Server error.', 'detail' => $e->getMessage()], 500);
}

function route(string $method, string $path): never
{
    // ── Public ──────────────────────────────────────────────────────────
    if ($method === 'POST' && $path === '/api/login')  handle_login();
    if ($method === 'POST' && $path === '/api/signup') handle_signup();
    if ($method === 'POST' && $path === '/api/logout') handle_logout();

    if ($path === '/' || $path === '/api') {
        json_out(['name' => 'CPACE Mobile API', 'status' => 'ok']);
    }

    // ── Authenticated (student bearer token) ────────────────────────────
    if (! str_starts_with($path, '/api/')) {
        json_out(['message' => 'Not found.'], 404);
    }

    $user = require_auth();

    if ($method === 'GET' && $path === '/api/user')        handle_user($user);
    if ($method === 'GET' && $path === '/api/dashboard')   handle_dashboard($user);
    if ($method === 'GET' && $path === '/api/subjects')    handle_subjects($user);
    if ($method === 'GET' && $path === '/api/performance') handle_performance($user);
    if ($method === 'GET' && $path === '/api/calendar')    handle_calendar($user);

    // Quiz engine
    if ($method === 'GET'  && $path === '/api/quizzes/history') handle_quiz_history($user);
    if ($method === 'POST' && $path === '/api/quizzes/start')   handle_quiz_start($user);
    if (preg_match('#^/api/quizzes/(\d+)$#', $path, $m) && $method === 'GET') {
        handle_quiz_take($user, (int) $m[1]);
    }
    if (preg_match('#^/api/quizzes/(\d+)/submit$#', $path, $m) && $method === 'POST') {
        handle_quiz_submit($user, (int) $m[1]);
    }
    if (preg_match('#^/api/quizzes/(\d+)/results$#', $path, $m) && $method === 'GET') {
        handle_quiz_results($user, (int) $m[1]);
    }
    if (preg_match('#^/api/quizzes/(\d+)/cancel$#', $path, $m) && $method === 'POST') {
        handle_quiz_cancel($user, (int) $m[1]);
    }

    // Review notes
    if ($method === 'GET'  && $path === '/api/review-notes') handle_notes_index($user);
    if ($method === 'POST' && $path === '/api/review-notes') handle_notes_store($user);
    if (preg_match('#^/api/review-notes/(\d+)$#', $path, $m)) {
        if ($method === 'GET')    handle_notes_show($user, (int) $m[1]);
        if ($method === 'PUT')    handle_notes_update($user, (int) $m[1]);
        if ($method === 'DELETE') handle_notes_destroy($user, (int) $m[1]);
    }
    if (preg_match('#^/api/review-notes/(\d+)/favorite$#', $path, $m) && $method === 'POST') {
        handle_notes_favorite($user, (int) $m[1]);
    }

    json_out(['message' => 'Not found.'], 404);
}
