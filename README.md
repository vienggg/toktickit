# TokTickIT — IT Service Desk Starter

TokTickIT is a full-stack IT service desk application built with React, Vite, Express, Prisma ORM, and PostgreSQL.

## 🛠 Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Bootstrap 5
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL 16
- **Testing**: Vitest, Supertest, React Testing Library
- **Containerization**: Docker & Docker Compose

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
re-running it never deletes real data created through the app.

---

## 🧪 Running Tests

- **Client Component Tests**:
  ```bash
  cd client
  npm test
  ```
- **Server API Tests**:
  ```bash
  cd server
  npm test
  ```

---

## 📁 Project Structure

- `client/`: React + Vite frontend UI application and Vitest tests
- `server/`: Express API backend, Prisma schema, seed script, and Supertest integration tests
- `docs/`: Lab documentation, session state handoffs, peer review logs, and report specifications