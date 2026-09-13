import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDirectory = path.join(repositoryRoot, 'server');
dotenv.config({ path: path.join(serverDirectory, '.env') });

const mode = process.argv[2];
const requestedTests = process.argv.slice(3);
if (!['server', 'e2e'].includes(mode)) {
  throw new Error('Use run-lab3-isolated.mjs with either "server" or "e2e".');
}
if (!process.env.DATABASE_URL) {
  throw new Error('Create server/.env with DATABASE_URL before running Lab 3 quality tests.');
}

const schema = `lab3_quality_${randomUUID().replaceAll('-', '')}`;
const isolatedUrl = new URL(process.env.DATABASE_URL);
isolatedUrl.searchParams.set('schema', schema);
const admin = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const isolatedEnvironment = {
  ...process.env,
  DATABASE_URL: isolatedUrl.toString(),
  LAB3_SEED_INITIAL_PASSWORD: 'Lab3Automated!2026',
  NODE_ENV: 'test'
};

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: isolatedEnvironment,
    stdio: 'inherit',
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  return result.status === 0;
}

function runNpm(args, cwd) {
  if (!process.env.npm_execpath) throw new Error('Run this helper through an npm script.');
  return run(process.execPath, [process.env.npm_execpath, ...args], cwd);
}

try {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  if (!runNpm(['exec', '--', 'prisma', 'migrate', 'deploy'], serverDirectory)) {
    throw new Error('Unable to apply migrations to the isolated Lab 3 schema.');
  }
  if (!runNpm(['exec', '--', 'tsx', 'prisma/seed.ts'], serverDirectory)) {
    throw new Error('Unable to seed the isolated Lab 3 schema.');
  }

  const passed = mode === 'server'
    ? runNpm(['--workspace', 'server', 'test', '--', '--run', '--no-file-parallelism'], repositoryRoot)
    : runNpm(['exec', '--', 'playwright', 'test', ...(requestedTests.length ? requestedTests : ['e2e/lab-03'])], repositoryRoot);
  if (!passed) process.exitCode = 1;
} finally {
  await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.$disconnect();
}
