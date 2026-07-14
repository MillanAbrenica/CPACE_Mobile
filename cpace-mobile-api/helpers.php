<?php
/** Shared request/response/auth helpers. */

declare(strict_types=1);

function json_out(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

/** Laravel-style validation error response. */
function validation_error(array $errors): never
{
    $first = reset($errors)[0] ?? 'The given data was invalid.';
    json_out(['message' => $first, 'errors' => $errors], 422);
}

function body(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '', true);
    if (! is_array($data)) {
        // fall back to form-encoded bodies
        $data = $_POST;
    }
    return $data;
}

function bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if ($header === '' && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    return preg_match('/Bearer\s+(\S+)/i', $header, $m) ? $m[1] : null;
}

/**
 * Authenticate the request — same rules as the web API's api.auth middleware:
 * valid bearer token in api_tokens, not expired, active student account.
 * Returns the users row.
 */
function require_auth(): object
{
    $raw = bearer_token();
    if (! $raw) {
        json_out(['message' => 'Unauthenticated.'], 401);
    }

    $stmt = db()->prepare('SELECT * FROM api_tokens WHERE token = ? LIMIT 1');
    $stmt->execute([$raw]);
    $token = $stmt->fetch();

    if (! $token || ($token->expires_at !== null && strtotime($token->expires_at) < time())) {
        json_out(['message' => 'Unauthenticated.'], 401);
    }

    $stmt = db()->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$token->user_id]);
    $user = $stmt->fetch();

    if (! $user || ! (bool) $user->is_active || (int) $user->role_id !== 2) {
        json_out(['message' => 'Unauthenticated.'], 401);
    }

    return $user;
}

/** User payload shape shared by login/signup/user — mirrors the web API. */
function user_payload(object $user): array
{
    $stmt = db()->prepare('SELECT * FROM student_profiles WHERE user_id = ? LIMIT 1');
    $stmt->execute([$user->id]);
    $profile = $stmt->fetch() ?: null;

    return [
        'id'               => (int) $user->id,
        'first_name'       => $user->first_name,
        'last_name'        => $user->last_name,
        'name'             => trim($user->first_name . ' ' . $user->last_name),
        'email'            => $user->email,
        'profile_photo'    => $user->profile_photo,
        'streak_days'      => (int) ($profile->streak_days ?? 0),
        'total_points'     => (int) ($profile->total_points ?? 0),
        'exam_target_date' => $profile->exam_target_date ?? null,
    ];
}

function now(): string
{
    return date('Y-m-d H:i:s');
}
