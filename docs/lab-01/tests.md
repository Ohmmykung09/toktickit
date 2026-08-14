# Lab 1 Test Evidence Plan

| Test ID | Test File | Tool | Test Description |
| --- | --- | --- | --- |
| UI-01 | client/tests/lab-01/App.test.tsx | Vitest | TokTickIT heading renders. |
| UI-02 | client/tests/lab-01/App.test.tsx | Vitest | Bootstrap Check System button is visible. |
| UI-03 | client/tests/lab-01/App.test.tsx | Vitest | Successful health check displays System Status: Online. |
| UI-04 | client/tests/lab-01/App.test.tsx | Vitest | Backend failure displays System Status: Offline and a useful error message. |
| API-00 | server/tests/lab-01/app.test.ts | Supertest | Express app starts and returns the foundation root response. |
| API-01 | server/tests/lab-01/app.test.ts | Supertest | Health endpoint returns 200 and expected JSON. |
| DB-00 | server/src/check-db.ts | Prisma | PostgreSQL connection check uses `DATABASE_URL` and runs `SELECT 1`. |
| DB-01 | server/prisma/seed.ts | Prisma | Category seed uses `upsert` to insert the four request categories without duplicates. |

Later Lab 1 feature branches will add the required `/api/categories` and category-list UI tests.
