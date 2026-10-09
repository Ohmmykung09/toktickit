import { mkdir } from 'node:fs/promises';
import { prepareDatabaseFixture } from './database-fixture.js';

export default async function globalSetup() {
  await Promise.all([
    mkdir('artifacts/lab-03/screenshots/authentication', { recursive: true }),
    mkdir('artifacts/lab-03/screenshots/requester', { recursive: true }),
    mkdir('artifacts/lab-03/screenshots/staff-queue', { recursive: true }),
    mkdir('artifacts/lab-03/screenshots/staff-ticket-detail', { recursive: true }),
    mkdir('artifacts/lab-03/screenshots/user-management', { recursive: true }),
    mkdir('artifacts/lab-04/screenshots/actions-taken', { recursive: true }),
    mkdir('artifacts/lab-04/screenshots/ticket-resolution', { recursive: true }),
    mkdir('artifacts/lab-04/screenshots/dashboards', { recursive: true })
  ]);
  await prepareDatabaseFixture();
}
