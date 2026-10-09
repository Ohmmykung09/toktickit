import { expect, test } from 'playwright/test';
import { captureResponsiveEvidence, collectBrowserErrors, signIn } from '../lab-03/evidence.js';
import {
  e2eUsers,
  requesterResolvedTicketNumber,
  requesterWaitingTicketNumber,
  staffUrgentTicketNumber
} from '../lab-03/fixture-data.js';

test('Requester and Staff dashboards show role-scoped metrics and actionable drill-downs', async ({ page }) => {
  await signIn(page, e2eUsers.requester.email);
  const browserErrors = collectBrowserErrors(page);
  await page.getByRole('button', { name: 'Open Dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  const requesterMetrics = page.locator('.requester-dashboard .dashboard-metrics');
  await expect(requesterMetrics).toContainText('Open Tickets');
  await expect(requesterMetrics).toContainText('Waiting for Requester');
  await expect(requesterMetrics.locator('article').filter({ hasText: 'Resolved in 7 days' }).locator('strong')).toHaveText('1');
  await expect(page.getByRole('heading', { name: 'Lab 4 E2E requester waiting ticket' }).first()).toBeVisible();
  await captureResponsiveEvidence(page, 'dashboards', 'requester-dashboard', 'lab-04', '.requester-dashboard');

  const resolvedDrilldown = page.getByRole('button', { name: 'View resolved Tickets' });
  await resolvedDrilldown.focus();
  await expect(resolvedDrilldown).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'My Tickets' })).toBeVisible();
  await expect(page.getByText(requesterResolvedTicketNumber)).toBeVisible();
  await expect(page.getByText(requesterWaitingTicketNumber)).toHaveCount(0);

  await page.getByRole('button', { name: 'Open My Tickets' }).click();
  await page.getByLabel('Search tickets').fill(requesterWaitingTicketNumber);
  await expect(page.getByText(requesterWaitingTicketNumber)).toBeVisible();
  await page.getByRole('button', { name: requesterWaitingTicketNumber }).click();
  await expect(page.getByRole('heading', { name: 'Actions Taken' })).toBeVisible();
  await expect(page.getByText('Reviewed the requester connection report.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Action Taken' })).toHaveCount(0);
  expect(browserErrors.errors).toEqual([]);

  await page.getByRole('button', { name: 'Log out' }).click();
  await signIn(page, e2eUsers.staff.email);
  const staffBrowserErrors = collectBrowserErrors(page);
  await page.getByRole('button', { name: 'Dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Staff Dashboard' })).toBeVisible();
  const staffMetrics = page.locator('.staff-dashboard .dashboard-metrics');
  await expect(staffMetrics).toContainText('Unassigned Tickets');
  await expect(staffMetrics).toContainText('My Actions Taken (7d)');
  await expect(page.getByText('Lab 4 E2E urgent unassigned ticket')).toBeVisible();
  await captureResponsiveEvidence(page, 'dashboards', 'staff-dashboard', 'lab-04', '.staff-dashboard');
  const urgentTicket = page.locator('.dashboard-ticket-list article').filter({ hasText: 'Lab 4 E2E urgent unassigned ticket' });
  await urgentTicket.getByRole('button', { name: 'Open ticket' }).click();
  await expect(page.getByRole('heading', { name: 'Lab 4 E2E urgent unassigned ticket' })).toBeVisible();
  expect(staffBrowserErrors.errors).toEqual([]);
});
