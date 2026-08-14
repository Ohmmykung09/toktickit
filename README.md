# TokTickIT

TokTickIT is the Lab 1 full-stack starter for CPE 334. This branch sets up the project foundation for a React/Vite frontend, an Express API backend, Prisma, PostgreSQL configuration, and automated test tooling.

## Project Structure

```text
toktickit/
├── client/
├── server/
│   ├── prisma/
│   ├── src/
│   └── tests/
│       └── lab-01/
├── docs/
│   └── lab-01/
├── .env.example
├── .gitignore
└── README.md
```

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL

## Setup

Install all workspace dependencies:

```powershell
npm install
```

Copy the environment template and set your local PostgreSQL connection string:

```powershell
Copy-Item .env.example server/.env
```

Example `DATABASE_URL`:

```text
postgresql://postgres:postgres@localhost:5432/toktickit?schema=public
```

Generate the Prisma client:

```powershell
npm run prisma:generate
```

Check that PostgreSQL is reachable with the configured `DATABASE_URL`:

```powershell
npm run db:check
```

Expected success output:

```text
PostgreSQL connection check passed.
```

Create or update the local database schema:

```powershell
npm run prisma:migrate
```

Seed the Lab 1 request categories:

```powershell
npm run prisma:seed
```

The seed is safe to run more than once and inserts these categories when missing:

```text
Account and Access
Hardware
Software
Network
```

## Development

Run the frontend:

```powershell
npm run dev:client
```

Run the backend:

```powershell
npm run dev:server
```

Build and run the compiled backend:

```powershell
npm run build --workspace server
npm start --workspace server
```

## Tests

Run all configured tests:

```powershell
npm test
```

Run frontend tests only:

```powershell
npm run test:client
```

Run backend tests only:

```powershell
npm run test:server
```
