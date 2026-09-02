import { expect, test } from 'playwright/test';

test('a requester creates, finds, opens, and manages an attachment on an owned ticket', async ({ page }) => {
  const summary = `E2E Wi-Fi issue ${Date.now()}`;

  await page.goto('/');
  await page.getByLabel('Development Requester').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Open Create Ticket' }).click();

  await page.getByLabel(/category/i).selectOption({ index: 1 });
  await page.getByLabel(/related system/i).selectOption({ index: 1 });
  await page.getByLabel(/ticket summary/i).fill(summary);
  await page.getByLabel(/requested priority/i).selectOption('HIGH');
  await page.getByLabel(/^description/i).fill('The campus Wi-Fi connection fails repeatedly on the assigned laptop.');
  await page.getByRole('button', { name: 'Create Ticket', exact: true }).click();

  await expect(page.getByText('Ticket created successfully.')).toBeVisible();
  await page.getByRole('button', { name: 'Open My Tickets' }).click();
  await expect(page.getByText(summary)).toBeVisible();
  await page.getByRole('button', { name: /TKT-/ }).first().click();
  await expect(page.getByRole('heading', { name: summary })).toBeVisible();

  await page.getByLabel('Attachment file').setInputFiles({
    name: 'evidence.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('TokTickIT E2E attachment evidence')
  });
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByText('Attachment uploaded successfully.')).toBeVisible();

  await page.getByLabel(/removal reason for evidence.pdf/i).fill('E2E cleanup after verification.');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('Attachment removed.')).toBeVisible();
});
