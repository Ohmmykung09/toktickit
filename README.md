# TokTickIT

TokTickIT is a full-stack IT service desk application for CPE 334. Lab 4 completes the authenticated Requester, IT Staff, and Administrator workflows with Actions Taken, guarded Ticket resolution, and role-scoped dashboards while preserving earlier ticket and attachment behavior.

Authentication uses an expiring server-side session in an `HttpOnly` cookie. Seeded local users must replace their explicitly configured initial password before entering the application. Requester identity now comes only from the authenticated session; the temporary Lab 2 requester selector and requester identity header have been removed.

## Technology

- Client: React, TypeScript, Vite, Bootstrap
- Server: Express, TypeScript, Prisma
- Database: PostgreSQL
- Automated tests: Vitest, Testing Library, Supertest

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL running locally

## Project Structure

```text
toktickit/
|- client/                       React requester application
|- server/                       Express API and Prisma schema
|- docs/lab-02/                  Lab 2 engineering and delivery records
|- docs/lab-03/                  Lab 3 contract, tests, review, and AI-use records
|- docs/lab-04/                  Lab 4 contract, tests, review, and AI-use records
|- e2e/                          Browser workflow specifications
`- artifacts/                    Final screenshot evidence locations
```

## Local Setup

Install workspace dependencies:

```powershell
npm install
```

Create the backend environment file and set your PostgreSQL password in `DATABASE_URL`:

```powershell
Copy-Item .env.example server/.env
```

Example value:

```text
DATABASE_URL="postgresql://postgres:<your-password>@localhost:5432/toktickit?schema=public"
```

Create the frontend environment file:

```powershell
Copy-Item client/.env.example client/.env
```

The local client uses this API base URL:

```text
VITE_API_BASE_URL="http://localhost:3000"
```

Add `LAB3_SEED_INITIAL_PASSWORD` to the ignored `server/.env` and enter a unique local-only value containing 12 to 128 characters and at least three character classes. Do not reuse a personal password. The repository provides no default credential, and the seed fails closed when this value is absent. Passwords are stored using Argon2id, and seeded users must change the initial password at first login.

Generate Prisma, apply migrations, and load the repeatable seed data:

```powershell
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run db:check
```

The seed preserves the Lab 2 Requesters as authenticated Users and creates the local demonstration accounts, realistic Tickets covering all eight lifecycle statuses, and Actions Taken covering active and terminal states. It retains categories, related systems, Public Comments, Internal Notes, and attachment examples. Repeat runs create missing fixtures and provision only null credential states; they do not overwrite user-managed records.

## Run Locally

Use two terminals from the repository root:

```powershell
npm run dev:server
```

```powershell
npm run dev:client
```

Open [http://localhost:5173](http://localhost:5173). The API runs at `http://localhost:3000`.

## Verification

Run all automated unit, API, and UI tests:

```powershell
npm test
```

Build both projects:

```powershell
npm run build
```

Install Chromium once for browser tests:

```powershell
npx playwright install chromium
```

Run the complete Lab 3 quality gate:

```powershell
npm run test:quality:lab3
```

Run the complete Lab 4 regression and quality gate. This runs all client suites, server suites and a separate performance smoke in isolated PostgreSQL schemas, the production build, and authenticated browser flows for Labs 2 to 4:

```powershell
npm run test:quality:lab4
```

Run only the Lab 4 browser flows:

```powershell
npm run test:e2e:lab4
```

The Lab 4 browser flows create and update Actions Taken, exercise the resolution gate and reopen cycle, and verify Requester and Staff dashboard drill-downs. They run against the real API, session/CSRF checks, and PostgreSQL. Responsive screenshots are written to `artifacts/lab-04/screenshots/` at 1440 x 1000, 820 x 1180, and 390 x 844. The flows also run axe WCAG A/AA checks, page-level horizontal-overflow checks, and browser-error assertions.

The synthetic 10,000-Ticket / 50,000-Action performance smoke is excluded from the default `npm run test:server` suite so it cannot affect fixture baseline tests. Run it independently against a disposable PostgreSQL schema with `npm run test:perf:lab4`; the Lab 4 quality gate includes this isolated run.

The server and E2E commands create a uniquely named PostgreSQL schema, apply the real migration history, seed test fixtures, run the tests, and remove only that temporary schema. The browser suite starts the local client and server, checks WCAG 2 A/AA and responsive overflow, and saves evidence at the authoritative desktop 1440 x 1000, tablet 820 x 1180, and mobile 390 x 844 viewports under `artifacts/lab-03/screenshots/`.

The full traceability tables and evidence instructions are in [docs/lab-03/tests.md](docs/lab-03/tests.md) and [docs/lab-04/tests.md](docs/lab-04/tests.md). The UI contracts are in [docs/lab-03/ui-spec.md](docs/lab-03/ui-spec.md) and [docs/lab-04/ui-spec.md](docs/lab-04/ui-spec.md). Peer-review findings and AI-use reflections are recorded in the corresponding `docs/lab-03/` and `docs/lab-04/` files.

## Lab 4 Demonstration

1. Sign in as an IT Staff user and open **Dashboard** to review unassigned, owned, and urgent Tickets.
2. Open an active Ticket, add an Action Taken with an assignee and result, and move it through its allowed lifecycle.
3. Try resolving before a qualifying Action Taken is completed; the workflow should explain why it is blocked.
4. Complete an Action Taken and resolve the Ticket. Close and reopen it to see the resolution cycle reset while preserving the Action history.
5. Sign in as the owning Requester and open **Dashboard**. Review the waiting and recent Ticket lists, then open the Ticket and confirm Actions Taken is read-only and Internal Notes remain hidden.
6. Sign in as an Administrator to review the shared Staff Dashboard and **User Management** navigation; a Requester must not access either protected area directly.

Use the unique initial password configured through `LAB3_SEED_INITIAL_PASSWORD` in `server/.env`; the repository does not contain a default login password.

## Lab 4 Release Flow

Lab 4 feature branches enter `lab4-staging` only through reviewed Pull Requests. After Issue #54 regression and evidence are complete, create one release Pull Request from `lab4-staging` to `main`. Run `npm run test:quality:lab4` from the integrated branch and capture passing output, screenshots, and required documentation for the submission.
