import { expect, test } from 'playwright/test';

const auth = { user: { id: 6, name: 'Ploy IT', email: 'ploy.it@example.test', role: 'IT_STAFF' }, mustChangePassword: false, csrfToken: 'e2e-csrf' };
const queue = { items: [{ ticketNumber: 'TKT-E2E-QUEUE', summary: 'Responsive queue evidence', requestedPriority: 'HIGH', itPriority: 'CRITICAL', status: 'OPEN', updatedAt: '2026-09-12T10:00:00.000Z', requester: { id: 1, name: 'Aom S.', email: 'aom@example.test' }, owner: null, category: { id: 1, name: 'Network' }, relatedSystem: { id: 1, name: 'Campus Wi-Fi' } }], filters: { categories: [], relatedSystems: [], owners: [] }, pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } };

test('staff queue hides requester actions and remains usable at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(auth) }));
  await page.route('**/api/staff/tickets?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(queue) }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ticket Queue' })).toBeVisible();
  await expect(page.locator('.queue-cards')).toBeVisible();
  await expect(page.locator('.queue-table-wrap')).toBeHidden();
  await expect(page.getByRole('button', { name: /open my tickets/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /open create ticket/i })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
