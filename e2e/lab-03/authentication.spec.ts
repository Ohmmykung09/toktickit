import { expect, test } from 'playwright/test';
import { captureResponsiveEvidence, signIn } from './evidence.js';
import { changedPassword, e2ePassword, e2eUsers } from './fixture-data.js';

test('validates login, forces the initial password change, and ends the session on logout', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await captureResponsiveEvidence(page, 'authentication', 'login');

  await page.getByLabel('Email').fill('unknown@example.test');
  await page.getByLabel('Password').fill(e2ePassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect.');

  await page.getByLabel('Email').fill(e2eUsers.inactive.email);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect.');

  await page.getByLabel('Email').fill(e2eUsers.firstLogin.email);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Change initial password' })).toBeVisible();
  await captureResponsiveEvidence(page, 'authentication', 'change-password');

  await page.getByLabel('Current password').fill(e2ePassword);
  await page.getByLabel('New password', { exact: true }).fill(changedPassword);
  await page.getByLabel('Confirm new password').fill(changedPassword);
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByRole('heading', { name: 'My Tickets' })).toBeVisible();
  await expect(page.getByText(e2eUsers.firstLogin.name, { exact: true })).toBeVisible();
  await expect(page.getByText('Requester', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  const protectedStatus = await page.evaluate(async () => {
    const response = await fetch('http://localhost:3000/api/tickets', { credentials: 'include' });
    return response.status;
  });
  expect(protectedStatus).toBe(401);
});

test('shows a safe failure when the authentication service cannot be reached', async ({ page }) => {
  await page.route('**/api/auth/login', (route) => route.abort());
  await page.goto('/');
  await page.getByLabel('Email').fill(e2eUsers.requester.email);
  await page.getByLabel('Password').fill(e2ePassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Unable to reach TokTickIT');
});
