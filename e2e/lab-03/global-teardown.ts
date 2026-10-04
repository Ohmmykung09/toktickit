import { removeDatabaseFixture } from './database-fixture.js';

export default async function globalTeardown() {
  await removeDatabaseFixture();
}
