import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from 'playwright/test';
import { e2ePassword } from './fixture-data.js';

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 }
] as const;

export async function signIn(page: Page, email: string, password = e2ePassword) {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
}

export async function assertAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations, results.violations.map((item) => `${item.id}: ${item.help}`).join('\n')).toEqual([]);
}

export async function captureResponsiveEvidence(page: Page, directory: string, screen: string) {
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(200);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `${screen} must not overflow horizontally at ${viewport.width}px.`
    ).toBe(true);
    await assertAccessible(page);
    await page.screenshot({
      fullPage: true,
      path: `artifacts/lab-03/screenshots/${directory}/${screen}-${viewport.name}.png`
    });
  }
}
