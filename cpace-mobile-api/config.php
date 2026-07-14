<?php
/**
 * CPACE Mobile API — standalone PHP backend for the CPACE_Mobile app.
 *
 * Connects to the SAME database as the CPACE web version (cpace_db on XAMPP)
 * and follows the same business rules, but is a fully separate codebase —
 * nothing in C:\xampp\htdocs\CPACE is used or modified.
 */

declare(strict_types=1);

// Match the Laravel web app (config/app.php timezone default).
date_default_timezone_set('UTC');

const DB_HOST = '127.0.0.1';
const DB_PORT = 3306;
const DB_NAME = 'cpace_db';
const DB_USER = 'root';
const DB_PASS = '';

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_OBJ,
            ]
        );
    }
    return $pdo;
}
