    # Lab 1 Test Evidence Plan

    | Test ID | Test File | Tool | Test Description |
    | --- | --- | --- | --- |
    | UI-01 | client/tests/lab-01/App.test.tsx | Vitest | TokTickIT heading renders. |
    | UI-02 | client/tests/lab-01/App.test.tsx | Vitest | Bootstrap Check System button is visible. |
    | UI-03 | client/tests/lab-01/App.test.tsx | Vitest | Successful system check displays System Status: Online and the category list. |
    | UI-04 | client/tests/lab-01/App.test.tsx | Vitest | Backend failure displays System Status: Offline and a useful error message. |
    | UI-05 | client/tests/lab-01/App.test.tsx | Vitest | Loading state is visible while the system check is in progress. |
    | API-00 | server/tests/lab-01/app.test.ts | Supertest | Express app starts and returns the foundation root response. |
    | API-01 | server/tests/lab-01/app.test.ts | Supertest | Health endpoint returns 200 and expected JSON. |
    | API-02 | server/tests/lab-01/app.test.ts | Supertest | Categories endpoint returns the four seeded categories. |
    | DB-00 | server/src/check-db.ts | Prisma | PostgreSQL connection check uses `DATABASE_URL` and runs `SELECT 1`. |
    | DB-01 | server/prisma/seed.ts | Prisma | Category seed uses `upsert` to insert the four request categories without duplicates. |

    Lab 1 now covers the foundation, health check, category seed, and category-list vertical slice.
