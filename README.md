# TokTickIT — IT Service Desk Starter

TokTickIT is a full-stack IT service desk application built with React, Vite, Express, Prisma ORM, and PostgreSQL.

## 🛠 Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Bootstrap 5
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL 16
- **Testing**: Vitest, Supertest, React Testing Library, Playwright
- **Containerization**: Docker & Docker Compose

## ✨ What it does
- **Requesters** create tickets, follow them, reply to IT, and see the steps IT has taken (read-only).
- **IT Staff** work a ticket queue, claim tickets, record **Actions Taken** (who did what, result, follow-up), keep internal notes, and resolve a ticket only when the resolution rules are met.
- **Administrators** do everything IT Staff do and manage users.
- Every role lands on a **Dashboard** whose counts open the matching filtered list.
- Ticket status changes are recorded in an append-only history. Edits use a version check, so two people editing the same record get a conflict message instead of a silent overwrite.

## 🚀 Quick Start with Docker (Recommended)

To run the complete full-stack application (PostgreSQL + Express API + React UI) in Docker containers:

```bash
docker compose up --build -d
```

- **React Frontend UI**: [http://localhost:5173](http://localhost:5173)
- **Express Backend API**: [http://localhost:3000](http://localhost:3000)

To stop the containers:
```bash
docker compose down
```

---

## 💻 Local Development Setup

### 1. Backend Setup
```bash
cd server
npm install
cp .env.example .env
npm run dev
```
The server will run on `http://localhost:3000`.

### 2. Frontend Setup
```bash
cd client
npm install
cp .env.example .env
npm run dev
```
The React dev server will run on `http://localhost:5173`.

### 3. Database Note (local, non-Docker development)
`server/.env`'s `DATABASE_URL` points at `localhost:5432`, so local development
expects a Postgres 16 server reachable there (this machine runs one inside a
WSL Ubuntu distro). **If you also run `docker compose up`, its `db` service
publishes host port 5433, not 5432** — deliberately, to avoid colliding with a
locally-installed Postgres. `docker compose`'s internal service-to-service
traffic (`server` → `db:5432`) is unaffected either way; this only matters if
you want to connect a host tool (psql, a GUI client) directly to one or the
other.

### 4. Seeded Accounts (local development only)
```bash
cd server
npx prisma migrate deploy
npx tsx prisma/seed.ts
```
Every seeded account (Requester, IT Staff, and Administrator) shares the
initial password **`ChangeMe123!`** and is forced through the mandatory
Change Password flow at first login. This is not a real secret — never reuse
it outside local development. The seed script is idempotent: it upserts
users/categories/systems and skips any ticket whose number already exists, so
re-running it never deletes real data created through the app. The Lab 4 part
of the seed adds sample Actions Taken and status history to existing tickets
(identified by a `seed-lab4-` prefix) and two extra IT users, and is safe to
re-run too.

---

## 🧪 Running Tests

- **Client Component Tests**:
  ```bash
  cd client
  npm test
  ```
- **Server API Tests** (needs the PostgreSQL database from section 3 running):
  ```bash
  cd server
  npm test
  ```
- **End-to-end tests** (Playwright starts the client and server itself; run from the repo root):
  ```bash
  npx playwright test
  ```

---

## 📁 Project Structure

- `client/`: React + Vite frontend UI application and Vitest tests
- `server/`: Express API backend, Prisma schema, seed script, and Supertest integration tests
- `e2e/`: Playwright end-to-end tests (`lab-03/`, `lab-04/`)
- `docs/`: Lab documentation, session state handoffs, peer review logs, and report specifications. Lab 4 lives in `docs/lab-04/` (specification, API spec, UI spec, tests, reviewer log, AI use)
- `artifacts/`: Migration rehearsal notes and screenshots for each lab