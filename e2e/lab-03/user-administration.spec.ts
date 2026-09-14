import { expect, test } from 'playwright/test';
import { captureResponsiveEvidence, signIn } from './evidence.js';
import { createdUserPassword, e2eUsers, managedUserEmail } from './fixture-data.js';

async function fillCreateUser(page: import('playwright/test').Page) {
  await page.getByLabel('User name').fill('Lab 3 Managed User');
  await page.getByLabel('User email').fill(managedUserEmail);
  await page.getByLabel('User role').selectOption('REQUESTER');
  await page.getByLabel('Initial password', { exact: true }).fill(createdUserPassword);
  await page.getByLabel('Confirm initial password').fill(createdUserPassword);
}

test('Administrator manages users and receives clear safety feedback', async ({ page }) => {
  await signIn(page, e2eUsers.administrator.email);
  await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
  await captureResponsiveEvidence(page, 'user-management', 'user-list');

  await page.getByRole('button', { name: 'Create user', exact: true }).click();
  await fillCreateUser(page);
  await captureResponsiveEvidence(page, 'user-management', 'create-user');
  await page.getByRole('button', { name: 'Submit create user' }).click();
  await expect(page.getByText('User created.')).toBeVisible();

  await page.getByRole('button', { name: 'Create user', exact: true }).click();
  await fillCreateUser(page);
  await page.getByRole('button', { name: 'Submit create user' }).click();
  await expect(page.getByRole('status')).toContainText('already exists');

  await page.getByLabel('Search users').fill(managedUserEmail);
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('button', { name: 'Edit Lab 3 Managed User' }).click();
  await page.getByLabel('User name').fill('Lab 3 Managed Staff');
  await page.getByLabel('User role').selectOption('IT_STAFF');
  await page.getByRole('button', { name: 'Submit user changes' }).click();
  await expect(page.getByText('User updated.')).toBeVisible();

  await page.getByLabel('Search users').fill(managedUserEmail);
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('button', { name: 'Edit Lab 3 Managed Staff' }).click();
  await page.getByLabel('New initial password', { exact: true }).fill('Lab3E2E!Reset2026');
  await page.getByLabel('Confirm new initial password').fill('Lab3E2E!Reset2026');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Set initial password' }).click();
  await expect(page.getByText(/existing sessions revoked/i)).toBeVisible();

  await page.getByLabel('Search users').fill(e2eUsers.administrator.email);
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('button', { name: `Edit ${e2eUsers.administrator.name}` }).click();
  await page.getByRole('checkbox', { name: 'Active account' }).uncheck();
  await page.getByRole('button', { name: 'Submit user changes' }).click();
  await expect(page.getByRole('status')).toContainText('cannot deactivate your own account');

  await page.getByRole('button', { name: 'Log out' }).click();
  await signIn(page, e2eUsers.requester.email);
  const forbiddenStatus = await page.evaluate(async () => {
    const response = await fetch('http://localhost:3000/api/admin/users', { credentials: 'include' });
    return response.status;
  });
  expect(forbiddenStatus).toBe(403);
  await expect(page.getByRole('heading', { name: 'User Management' })).toHaveCount(0);
});
