import { expect, test } from 'playwright/test';
import { captureResponsiveEvidence, collectBrowserErrors, signIn } from '../lab-03/evidence.js';
import { actionTicketNumber, e2eUsers } from '../lab-03/fixture-data.js';

async function openTicket(page: import('playwright/test').Page) {
  await page.getByLabel('Search tickets').fill(actionTicketNumber);
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('button', { name: `Open ${actionTicketNumber}` }).click();
  await expect(page.getByRole('heading', { name: 'Lab 4 E2E Actions Taken workflow' })).toBeVisible();
}

test('IT Staff records, updates, completes, and reviews Actions Taken with retry-safe input', async ({ page }) => {
  await signIn(page, e2eUsers.staff.email);
  const browserErrors = collectBrowserErrors(page);
  await openTicket(page);

  const description = 'Reviewed endpoint logs and repaired the VPN profile.';
  const result = 'A fresh VPN profile connected successfully in the verification test.';
  await page.getByLabel('create action description').fill(description);
  await page.getByLabel('create action result').fill(result);
  await page.getByLabel('create action assignee').selectOption({ label: e2eUsers.staff.name });
  await page.getByRole('checkbox', { name: 'Follow-Up Required' }).check();
  await page.getByLabel('create follow-up note').fill('Confirm the connection remains stable tomorrow.');

  const apiBaseUrl = process.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
  const createUrl = new URL(`/api/staff/tickets/${actionTicketNumber}/actions-taken`, apiBaseUrl).toString();
  let createRequests = 0;
  const idempotencyKeys: string[] = [];
  let releaseFirstAttempt!: () => void;
  let signalFirstAttempt!: () => void;
  const firstAttemptMayProceed = new Promise<void>((resolve) => { releaseFirstAttempt = resolve; });
  const firstAttemptArrived = new Promise<void>((resolve) => { signalFirstAttempt = resolve; });
  await page.route(createUrl, async (route) => {
    createRequests += 1;
    idempotencyKeys.push(route.request().headers()['idempotency-key'] ?? '');
    if (createRequests === 1) {
      signalFirstAttempt();
      await firstAttemptMayProceed;
      const committedResponse = await route.fetch();
      expect(committedResponse.status()).toBe(201);
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  const addAction = page.getByRole('button', { name: 'Add Action Taken' });
  browserErrors.expectRequestFailure(createUrl);
  await addAction.click();
  await firstAttemptArrived;
  const createSubmit = page.locator('.action-create-form button[type="submit"]');
  await expect(createSubmit).toBeDisabled();
  await createSubmit.click({ force: true });
  expect(createRequests).toBe(1);
  releaseFirstAttempt();
  await expect(page.getByRole('status')).toContainText('Unable to reach TokTickIT. Try again.');
  await expect(page.getByLabel('create action description')).toHaveValue(description);
  await addAction.click();
  await expect(page.getByRole('status')).toContainText('Action Taken created.');
  expect(createRequests).toBe(2);
  expect(idempotencyKeys[1]).toBe(idempotencyKeys[0]);
  await expect(page.getByText(description)).toBeVisible();
  await expect(page.getByText(result)).toBeVisible();
  const matchingAction = page.locator('.actions-list article').filter({ hasText: description });
  await expect(matchingAction).toHaveCount(1);

  await matchingAction.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Edit action status').selectOption('IN_PROGRESS');
  await page.getByRole('button', { name: 'Save Action' }).click();
  await expect(page.getByRole('status')).toContainText('Action Taken updated.');
  await expect(matchingAction.getByText('In Progress')).toBeVisible();

  await matchingAction.getByRole('button', { name: 'Edit' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Edit action status').selectOption('COMPLETED');
  await page.getByRole('button', { name: 'Save Action' }).click();
  await expect(page.getByRole('status')).toContainText('Action Taken updated.');
  await expect(matchingAction.getByText('Completed')).toBeVisible();
  await expect(matchingAction.getByRole('button', { name: 'Edit' })).toHaveCount(0);

  const cancelledDescription = 'Cancelled the duplicate troubleshooting action.';
  await page.getByLabel('create action description').fill(cancelledDescription);
  await page.getByLabel('create action result').fill('A duplicate action was not required.');
  await page.getByLabel('create action assignee').selectOption({ label: e2eUsers.staff.name });
  await page.getByRole('button', { name: 'Add Action Taken' }).click();
  await expect(page.getByRole('status')).toContainText('Action Taken created.');
  const cancelledAction = page.locator('.actions-list article').filter({ hasText: cancelledDescription });
  await cancelledAction.getByRole('button', { name: 'Edit' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Edit action status').selectOption('CANCELLED');
  await page.getByRole('button', { name: 'Save Action' }).click();
  await expect(page.locator('.actions-taken-panel [role="status"]')).toContainText('Action Taken updated.');
  await expect(cancelledAction.getByText('Cancelled', { exact: true })).toBeVisible();
  await expect(cancelledAction.getByRole('button', { name: 'Edit' })).toHaveCount(0);

  await captureResponsiveEvidence(page, 'actions-taken', 'staff-ticket-actions', 'lab-04', '.actions-taken-panel');
  expect(browserErrors.errors).toEqual([]);
});
