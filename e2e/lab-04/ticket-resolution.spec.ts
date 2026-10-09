import { expect, test } from 'playwright/test';
import { captureResponsiveEvidence, collectBrowserErrors, signIn } from '../lab-03/evidence.js';
import { e2eUsers, resolutionTicketNumber } from '../lab-03/fixture-data.js';

async function openTicket(page: import('playwright/test').Page) {
  await page.getByLabel('Search tickets').fill(resolutionTicketNumber);
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('button', { name: `Open ${resolutionTicketNumber}` }).click();
  await expect(page.getByRole('heading', { name: 'Lab 4 E2E Ticket resolution workflow' })).toBeVisible();
}

async function transition(page: import('playwright/test').Page, status: string) {
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Set ticket status').selectOption(status);
}

test('blocks premature resolution, preserves action history, and requires new work after reopen', async ({ page }) => {
  await signIn(page, e2eUsers.staff.email);
  const browserErrors = collectBrowserErrors(page);
  const apiBaseUrl = process.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
  const resolutionUrl = new URL(`/api/staff/tickets/${resolutionTicketNumber}/status`, apiBaseUrl).toString();
  let resolutionConflicts = 0;
  page.on('response', (response) => {
    if (response.url() === resolutionUrl && response.status() === 409) resolutionConflicts += 1;
  });
  await openTicket(page);

  browserErrors.expectHttpError(resolutionUrl, 409);
  await transition(page, 'RESOLVED');
  await expect(page.getByRole('status')).toContainText('Complete a qualifying Action Taken for the current resolution cycle before resolving this Ticket.');
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  const description = 'Completed the requested service repair.';
  await page.getByLabel('create action description').fill(description);
  await page.getByLabel('create action result').fill('The requester workflow passed the post-repair verification.');
  await page.getByLabel('create action assignee').selectOption({ label: e2eUsers.staff.name });
  await page.getByRole('button', { name: 'Add Action Taken' }).click();
  await expect(page.locator('.actions-taken-panel [role="status"]')).toContainText('Action Taken created.');

  const actionCard = page.locator('.actions-list article').filter({ hasText: description });
  await actionCard.getByRole('button', { name: 'Edit' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Edit action status').selectOption('COMPLETED');
  await page.getByRole('button', { name: 'Save Action' }).click();
  await expect(page.locator('.actions-taken-panel [role="status"]')).toContainText('Action Taken updated.');
  await expect(actionCard.getByText('Completed', { exact: true })).toBeVisible();

  browserErrors.expectHttpError(resolutionUrl, 409);
  await transition(page, 'RESOLVED');
  await expect(page.locator('.staff-detail > header')).toContainText('Resolved');
  await transition(page, 'CLOSED');
  await expect(page.locator('.staff-detail > header')).toContainText('Closed');
  await transition(page, 'REOPENED');
  await expect(page.locator('.staff-detail > header')).toContainText('Reopened');
  await expect(page.getByText(description)).toBeVisible();

  await transition(page, 'RESOLVED');
  await expect(page.getByRole('status')).toContainText('Complete a qualifying Action Taken for the current resolution cycle before resolving this Ticket.');
  await expect(page.getByText(description)).toBeVisible();
  expect(resolutionConflicts).toBe(2);
  await captureResponsiveEvidence(page, 'ticket-resolution', 'reopened-ticket-detail', 'lab-04', '.staff-detail');
  expect(browserErrors.errors).toEqual([]);
});
