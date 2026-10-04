import { expect, test } from 'playwright/test';
import { captureResponsiveEvidence, signIn } from './evidence.js';
import { e2eUsers } from './fixture-data.js';

test('requester creates and manages an owned ticket without a development identity selector', async ({ page }) => {
  const summary = `Lab 3 E2E requester ticket ${Date.now()}`;
  await signIn(page, e2eUsers.requester.email);
  await expect(page.getByRole('heading', { name: 'My Tickets' })).toBeVisible();
  await expect(page.getByLabel('Development Requester')).toHaveCount(0);
  await captureResponsiveEvidence(page, 'requester', 'my-tickets');

  await page.getByRole('button', { name: 'Open Create Ticket' }).click();
  await expect(page.getByRole('heading', { name: 'Create Ticket' })).toBeVisible();
  await captureResponsiveEvidence(page, 'requester', 'create-ticket');
  await page.getByLabel(/category/i).selectOption({ label: 'Network' });
  await page.getByLabel(/related system/i).selectOption({ label: 'Campus Wi-Fi' });
  await page.getByLabel(/ticket summary/i).fill(summary);
  await page.getByLabel(/requested priority/i).selectOption('HIGH');
  await page.getByLabel(/^description/i).fill('The campus Wi-Fi repeatedly disconnects during an online class.');
  await page.getByRole('button', { name: 'Create Ticket', exact: true }).click();
  await expect(page.getByText('Ticket created successfully.')).toBeVisible();

  await page.getByRole('button', { name: 'Open My Tickets' }).click();
  const ticketRow = page.getByRole('row').filter({ hasText: summary });
  await expect(ticketRow).toBeVisible();
  await ticketRow.getByRole('button', { name: /TKT-/ }).click();
  await expect(page.getByRole('heading', { name: summary })).toBeVisible();

  await page.getByLabel('Add Public Comment').fill('Requester confirms the disconnect still happens after reconnecting.');
  await page.getByRole('button', { name: 'Post Public Comment' }).click();
  await expect(page.getByText('Public Comment posted.')).toBeVisible();
  await expect(page.getByText('Requester confirms the disconnect still happens after reconnecting.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Internal Notes' })).toHaveCount(0);

  await page.getByLabel('Attachment file').setInputFiles({
    name: 'requester-evidence.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('Lab 3 requester browser evidence')
  });
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByText('Attachment uploaded successfully.')).toBeVisible();

  await page.getByLabel(/removal reason for requester-evidence.pdf/i).fill('Browser evidence cleanup');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('Attachment removed.')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Problem Appears Resolved' }).click();
  await expect(page.getByText('Problem Appears Resolved indication recorded.')).toBeVisible();
  await captureResponsiveEvidence(page, 'requester', 'ticket-detail');
});
