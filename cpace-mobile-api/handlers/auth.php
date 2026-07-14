<?php
/** Auth endpoints — same rules as the web API's AuthApiController. */

declare(strict_types=1);

function handle_login(): never
{
    $data = body();
    $errors = [];
    if (empty($data['email']) || ! filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = ['The email field is required.'];
    }
    if (empty($data['password'])) {
        $errors['password'] = ['The password field is required.'];
    }
    if ($errors) {
        validation_error($errors);
    }

    $stmt = db()->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$data['email']]);
    $user = $stmt->fetch();

    if (! $user || ! password_verify($data['password'], $user->password)) {
        validation_error(['email' => ['These credentials do not match our records.']]);
    }

    if (! (bool) $user->is_active) {
        json_out(['message' => 'Your account has been deactivated.'], 403);
    }

    // role_id 2 = student — mobile access is for students only (same as web API).
    if ((int) $user->role_id !== 2) {
        json_out(['message' => 'Mobile access is for students only.'], 403);
    }

    db()->prepare('UPDATE users SET last_login_at = ? WHERE id = ?')->execute([now(), $user->id]);

    json_out([
        'token' => generate_token((int) $user->id),
        'user'  => user_payload($user),
    ]);
}

function handle_signup(): never
{
    $data = body();
    $errors = [];

    if (empty($data['first_name'])) $errors['first_name'] = ['The first name field is required.'];
    if (empty($data['last_name']))  $errors['last_name']  = ['The last name field is required.'];

    if (empty($data['email']) || ! filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = ['A valid email is required.'];
    } else {
        $stmt = db()->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$data['email']]);
        if ($stmt->fetch()) {
            $errors['email'] = ['The email has already been taken.'];
        }
    }

    if (empty($data['password']) || strlen((string) $data['password']) < 8) {
        $errors['password'] = ['The password must be at least 8 characters.'];
    } elseif (($data['password_confirmation'] ?? null) !== $data['password']) {
        $errors['password'] = ['The password confirmation does not match.'];
    }

    if ($errors) {
        validation_error($errors);
    }

    // role_id 2 = student; bcrypt matches the web app's hashing.
    db()->prepare(
        'INSERT INTO users (role_id, first_name, last_name, email, password, created_at, updated_at)
         VALUES (2, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $data['first_name'], $data['last_name'], $data['email'],
        password_hash((string) $data['password'], PASSWORD_BCRYPT),
        now(), now(),
    ]);
    $userId = (int) db()->lastInsertId();

    db()->prepare('INSERT INTO student_profiles (user_id) VALUES (?)')->execute([$userId]);

    $stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    json_out([
        'token' => generate_token($userId),
        'user'  => user_payload($user),
    ], 201);
}

function handle_logout(): never
{
    $raw = bearer_token();
    if ($raw) {
        db()->prepare('DELETE FROM api_tokens WHERE token = ?')->execute([$raw]);
    }
    json_out(['message' => 'Logged out.']);
}

function handle_user(object $user): never
{
    json_out(['user' => user_payload($user)]);
}

/** 128-hex-char token, 30-day expiry — same format as the web's ApiToken::generate(). */
function generate_token(int $userId): string
{
    $token = bin2hex(random_bytes(64));
    db()->prepare(
        'INSERT INTO api_tokens (user_id, token, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)'
    )->execute([$userId, $token, date('Y-m-d H:i:s', strtotime('+30 days')), now(), now()]);
    return $token;
}
