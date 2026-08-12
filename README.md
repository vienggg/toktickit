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