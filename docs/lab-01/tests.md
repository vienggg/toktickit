# Lab 1 — Test Plan and Evidence

All test files live under `server/tests/lab-01/` and `client/tests/lab-01/`.

| # | Tool | Test File | Test Description | Result |
|---|------|-----------|------------------|--------|
| 1 | Supertest | `server/tests/lab-01/health.test.ts` | GET /api/health returns HTTP 200, status=ok, service=TokTickIT API | PASS |
| 2 | Supertest | `server/tests/lab-01/categories.test.ts` | GET /api/categories returns 4 seeded categories in id order | Configured (Requires DB) |
| 3 | Vitest | `client/tests/lab-01/App.test.tsx` | Heading renders TokTickIT | PASS |
| 4 | Vitest | `client/tests/lab-01/App.test.tsx` | Success state shows Online badge + category list | PASS |
| 5 | Vitest | `client/tests/lab-01/App.test.tsx` | Error state shows Offline badge + useful error message | PASS |

## Terminal Output Evidence

### 1. Client Unit Tests (Vitest + React Testing Library)
```text
 RUN  v2.1.9 C:/Users/User/OneDrive/Desktop/softwareengineer/lab1/toktickit/client

 ✓ tests/lab-01/App.test.tsx (3 tests) 175ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  19:02:57
   Duration  1.72s
```

### 2. Server API Health Test (Supertest + Vitest)
```text
 RUN  v2.1.9 C:/Users/User/OneDrive/Desktop/softwareengineer/lab1/toktickit/server

 ✓ tests/lab-01/health.test.ts (1 test) 19ms
```
