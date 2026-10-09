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
  const browserErrors = collectBrowserErrors(page, [/503 \(Service Unavailable\)/]);
  await openTicket(page);

  const description = 'Reviewed endpoint logs and repaired the VPN profile.';
  const result = 'A fresh VPN profile connected successfully in the verification test.';
  await page.getByLabel('create action description').fill(description);
  await page.getByLabel('create action result').fill(result);
  await page.getByLabel('create action assignee').selectOption({ label: e2eUsers.staff.name });
  await page.getByRole('checkbox', { name: 'Follow-Up Required' }).check();
  await page.getByLabel('create follow-up note').fill('Confirm the connection remains stable tomorrow.');

  let abortNextCreate = true;
  await page.route(`**/api/staff/tickets/${actionTicketNumber}/actions-taken`, async (route) => {
    if (abortNextCreate) {
      abortNextCreate = false;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Temporary service error. Try again.' } }) });
      return;
    }
    await route.continue();
  });
  await page.getByRole('button', { name: 'Add Action Taken' }).click();
  await expect(page.getByRole('status')).toContainText('Temporary service error. Try again.');
  await expect(page.getByLabel('create action description')).toHaveValue(description);
  await page.getByRole('button', { name: 'Add Action Taken' }).click();
  await expect(page.getByRole('status')).toContainText('Action Taken created.');
  await expect(page.getByText(description)).toBeVisible();
  await expect(page.getByText(result)).toBeVisible();

  const actionCard = page.locator('.actions-list article').filter({ hasText: description });
  await actionCard.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Edit action status').selectOption('IN_PROGRESS');
  await page.getByRole('button', { name: 'Save Action' }).click();
  await expect(page.getByRole('status')).toContainText('Action Taken updated.');
  await expect(actionCard.getByText('In Progress')).toBeVisible();

  await actionCard.getByRole('button', { name: 'Edit' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Edit action status').selectOption('COMPLETED');
  await page.getByRole('button', { name: 'Save Action' }).click();
  await expect(page.getByRole('status')).toContainText('Action Taken updated.');
  await expect(actionCard.getByText('Completed')).toBeVisible();
  await expect(actionCard.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await captureResponsiveEvidence(page, 'actions-taken', 'staff-ticket-actions', 'lab-04');
  expect(browserErrors).toEqual([]);
});
