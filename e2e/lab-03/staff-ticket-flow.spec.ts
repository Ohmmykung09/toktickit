import { expect, test } from 'playwright/test';
import { captureResponsiveEvidence, signIn } from './evidence.js';
import { e2eUsers, staffTicketNumber } from './fixture-data.js';

test('IT Staff finds, claims, prioritizes, progresses, and communicates on a ticket', async ({ page }) => {
  await signIn(page, e2eUsers.staff.email);
  await expect(page.getByRole('heading', { name: 'Ticket Queue' })).toBeVisible();
  await page.getByLabel('Search tickets').fill(staffTicketNumber);
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText(staffTicketNumber).first()).toBeVisible();
  await captureResponsiveEvidence(page, 'staff-queue', 'ticket-queue');

  const openButton = page.getByRole('button', { name: `Open ${staffTicketNumber}` });
  if (await openButton.isVisible()) await openButton.click();
  else await page.getByRole('button', { name: `Open ${staffTicketNumber} mobile` }).click();
  await expect(page.getByRole('heading', { name: 'Lab 3 E2E staff workflow' })).toBeVisible();

  await page.getByRole('button', { name: 'Claim ticket' }).click();
  await expect(page.getByLabel('Ticket owner')).toHaveValue(/\d+/);
  await page.getByLabel('Set IT priority').selectOption('CRITICAL');
  await expect(page.getByLabel('Set IT priority')).toHaveValue('CRITICAL');
  await page.getByLabel('Set ticket status').selectOption('IN_PROGRESS');
  await expect(page.getByText('In Progress', { exact: true })).toBeVisible();

  await page.getByLabel('Add Public Comment').fill('IT Staff is investigating the connection logs.');
  await page.getByRole('button', { name: 'Post Public Comment' }).click();
  await expect(page.getByText('IT Staff is investigating the connection logs.')).toBeVisible();
  await page.getByLabel('Add Internal Note').fill('Private diagnostic note for authorized staff only.');
  await page.getByRole('button', { name: 'Post Internal Note' }).click();
  await expect(page.getByText('Private diagnostic note for authorized staff only.')).toBeVisible();
  await captureResponsiveEvidence(page, 'staff-ticket-detail', 'ticket-detail');
});
