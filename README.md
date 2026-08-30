# TaskFlow

A multi-project task tracker with a real Kanban board — built to serve as a realistic base
for practicing production deployment work: containerization, CI/CD, Kubernetes, and observability.

This README covers the **application itself**. How you containerize, deploy, and monitor
it is intentionally left to you.

## Stack

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + Vite + TypeScript + React Router + Recharts
- **Database**: PostgreSQL
- **Cache**: Redis
- **Auth**: JWT (jsonwebtoken) + bcrypt password hashing

## Features

- **Auth** — register/login, JWT-based sessions, protected routes
- **Email verification** — a verification link is sent on registration and on email
  change. If no SMTP is configured (the default), the app automatically creates a free,
  temporary [Ethereal](https://ethereal.email) inbox and returns a clickable preview link
  right in the API response — the frontend shows an "Open verification email preview"
  button so this is fully testable without any mail server setup. This fallback triggers
  purely based on whether `SMTP_HOST` is set, not on `NODE_ENV` — so it works the same
  whether you run `npm run dev` locally or `docker compose up` (which sets
  `NODE_ENV=production` on the backend container). If Ethereal itself is unreachable (e.g.
  no internet), it falls back further to logging the email to the backend console. Set
  `SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD` in `.env` to send through real SMTP instead —
  once that's set, the preview link disappears since it's genuinely being sent.
- **Profile management** — change your name freely; changing your email requires your
  current password (and re-triggers verification); change your password with current+new.
- **Task sharing** — a project owner can share an individual task with another existing
  TaskFlow user by email, as "can view" or "can edit". Sharing a task does **not** give
  access to the rest of that project — access is scoped to that one task. Shared tasks
  show up for the recipient under "Shared with me".
- **Projects** — each user manages multiple projects, scoped strictly to their own account
- **Kanban board** — drag-and-drop tasks between To Do / In Progress / Done
- **Tasks** — priority (low/medium/high/urgent), due dates with overdue flagging, tags,
  per-project sequential ticket numbers (e.g. `WR-14`, derived from the project name)
- **Comments** — threaded comments per task (owners and edit-level shares can post;
  view-only shares can read but not post)
- **Dashboard** — status/priority breakdown, overdue count, upcoming deadlines, a chart
- **Search & filter** — by text, priority, and status on the board

## Why Redis is actually load-bearing here

- `GET /api/tasks` responses are cached in Redis per project+filter combination, invalidated
  on any create/update/delete. Response includes an `X-Cache: HIT|MISS` header.
- Rate limiting (`express-rate-limit` + `rate-limit-redis`) is backed by Redis, not in-memory,
  so it works correctly once the backend is scaled to multiple replicas — every pod shares
  the same counters instead of each pod having its own independent limit.

## Running it locally without Docker

**Backend:**
```bash
cd backend
cp .env.example .env   # edit DB_HOST/REDIS_HOST to localhost, set a real JWT_SECRET
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

You'll need a local Postgres and Redis instance reachable at whatever you set in
`backend/.env`. The backend runs its own migrations automatically on startup
(`backend/migrations/*.sql`, applied in order).

## API

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/healthz` | GET | – | Liveness |
| `/readyz` | GET | – | Readiness (checks DB + Redis) |
| `/metrics` | GET | – | Prometheus metrics |
| `/api/auth/register` | POST | – | Create an account (sends verification email) |
| `/api/auth/login` | POST | – | Get a JWT |
| `/api/auth/verify-email?token=` | GET | – | Confirm an email address |
| `/api/auth/me` | GET | ✓ | Current user |
| `/api/auth/resend-verification` | POST | ✓ | Re-send the verification email |
| `/api/auth/profile` | PUT | ✓ | Update name/email (email change needs `currentPassword`) |
| `/api/auth/password` | PUT | ✓ | Change password (needs `currentPassword` + `newPassword`) |
| `/api/projects` | GET/POST | ✓ | List / create projects |
| `/api/projects/:id` | PUT/DELETE | ✓ | Update / delete a project |
| `/api/tasks?project_id=` | GET | ✓ | List tasks (filters: `status`, `priority`, `search`, `assignee_id`) |
| `/api/tasks/shared` | GET | ✓ | Tasks shared with the current user |
| `/api/tasks` | POST | ✓ | Create a task |
| `/api/tasks/:id` | GET/PUT/DELETE | ✓ | Read / update / delete a task (owner or share, per permission) |
| `/api/tasks/:id/comments` | GET/POST | ✓ | List / add comments |
| `/api/tasks/:id/shares` | GET/POST | ✓ | List shares / share a task by email (owner only) |
| `/api/tasks/:id/shares/:userId` | DELETE | ✓ | Revoke a share (owner only) |
| `/api/dashboard/stats?project_id=` | GET | ✓ | Aggregate stats (all projects if `project_id` omitted) |

Protected routes expect `Authorization: Bearer <token>`.

## Tests

```bash
# backend (42 tests: auth, verification, profile, task CRUD, sharing/access control, comments)
cd backend && npm test

# frontend (19 tests: utils, LoginPage, ProfilePage, TaskCard)
cd frontend && npm test
```

Backend tests mock the DB/Redis layer so they run fast with no external dependencies.
The Redis-backed rate limiter specifically is skipped in the test environment (see
`src/middleware/rateLimiter.ts`) since it needs a real Redis to load its Lua scripts —
that's a good candidate for an integration-test stage once you're building CI/CD.

## What's included vs. what's on you

Included as a starting reference (use it, rewrite it, or delete it — your call):
- `docker-compose.yml` / `docker-compose.monitoring.yml`, configured entirely from a root
  `.env` file (`cp .env.example .env` before running `docker compose up`) — every port,
  credential, and app setting the compose stack uses is a variable there, not hardcoded
  in the compose file itself
- `kubernetes/` manifests (including a blue-green example for the backend)
- `monitoring/` configs for Prometheus, Grafana, Loki, Promtail

Not included, by design — this is the part you're doing yourself:
- GitHub Actions CI/CD pipeline (build, test, security scanning, deploy)
- Canary deployment manifests/scripts
- Terraform / Ansible for infrastructure
- Any deployment automation scripts

One thing worth knowing before you deploy: the `kubernetes/` and `docker-compose*.yml`
reference files were written for the *original* single-table version of this app and were
only lightly patched (adding `JWT_SECRET`) to keep them from being outright broken. They
haven't been re-verified against the current schema/features — treat them as a rough
starting point, not a tested deployment.
