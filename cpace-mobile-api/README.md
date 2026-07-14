# CPACE Mobile API (PHP)

Standalone PHP backend for the **CPACE_Mobile** app. It is a separate codebase
from the CPACE web version, but follows the **same process** (same business
rules, same endpoints, same response shapes) and connects to the **same
database** (`cpace_db` on XAMPP MySQL) — so quizzes taken on mobile show up on
the web dashboard and vice versa.

## Run

1. Start **MySQL** in the XAMPP Control Panel (Apache is not required for this API).
2. Double-click `start-api.bat` (or run `"C:\xampp\php\php.exe" -S 0.0.0.0:8080 index.php`).
3. The API is now at `http://localhost:8080/api` (and `http://<your-PC-IP>:8080/api` for phones on the same Wi-Fi).

## Structure

| File | Purpose |
|---|---|
| `index.php` | Front controller / router (all `/api/*` routes) |
| `config.php` | Database connection (cpace_db) |
| `helpers.php` | JSON responses, bearer-token auth, validation errors |
| `services.php` | Business rules ported from the web version: streaks, weakness detection (60% / 5 attempts / 3-in-a-row), SM-2 spaced repetition, question paraphrasing |
| `handlers/auth.php` | login, signup, logout, user (students only, `api_tokens` bearer tokens) |
| `handlers/dashboard.php` | dashboard summary + subjects list |
| `handlers/quiz.php` | start/take/submit/results/cancel/history — server-side selection, shuffling, grading, points, streak, SM-2 |
| `handlers/performance.php` | analytics: stats, daily series, strengths/weaknesses, per-subject, per-mode |
| `handlers/notes.php` | review notes CRUD + favorite |
| `handlers/calendar.php` | spaced-repetition calendar (month grid, due/upcoming) |

## Endpoints

Same contract as the web version's `routes/api.php`:

- `POST /api/login`, `POST /api/signup`, `POST /api/logout`, `GET /api/user`
- `GET /api/dashboard`, `GET /api/subjects`, `GET /api/performance`, `GET /api/calendar?month=YYYY-MM`
- `POST /api/quizzes/start`, `GET /api/quizzes/{id}`, `POST /api/quizzes/{id}/submit`,
  `GET /api/quizzes/{id}/results`, `POST /api/quizzes/{id}/cancel`, `GET /api/quizzes/history`
- `GET|POST /api/review-notes`, `GET|PUT|DELETE /api/review-notes/{id}`, `POST /api/review-notes/{id}/favorite`
