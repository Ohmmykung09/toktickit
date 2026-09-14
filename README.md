# TokTickIT

TokTickIT is a full-stack IT service desk application for CPE 334. Lab 3 adds authenticated Requester, IT Staff, and Administrator accounts while preserving the completed Lab 2 ticket and attachment workflows.

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
|- docs/lab-03/                  Lab 3 engineering contract and test plan
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

The seed preserves the Lab 2 Requesters as authenticated Users and creates four active Requesters, one inactive Requester, three active IT Staff, one inactive IT Staff, one active Administrator, and realistic tickets covering all eight Lab 3 statuses. It retains the four categories and seven related systems and adds safe Public Comment and Internal Note fixtures. Repeat runs create missing fixtures and provision only null credential states; they do not overwrite user-managed records.

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

Install Chromium once for the Lab 3 browser tests:

```powershell
npx playwright install chromium
```

Run the complete Lab 3 quality gate:

```powershell
npm run test:quality:lab3
```

The server and E2E commands create a uniquely named PostgreSQL schema, apply the real migration history, seed test fixtures, run the tests, and remove only that temporary schema. The browser suite starts the local client and server, checks WCAG 2 A/AA and responsive overflow, and saves desktop, tablet, and mobile evidence under `artifacts/lab-03/screenshots/`.

The full traceability table and final evidence instructions are in [docs/lab-03/tests.md](docs/lab-03/tests.md). The completed responsive checklist is in [docs/lab-03/ui-spec.md](docs/lab-03/ui-spec.md).
