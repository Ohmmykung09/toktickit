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

export function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  const expectedHttpErrors: Array<{ url: string; status: number; remaining: number }> = [];
  const expectedRequestFailures: Array<{ url: string; remaining: number }> = [];
  let expectedNetworkErrorConsoleMessages = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (message.text() === 'Failed to load resource: net::ERR_FAILED' && expectedNetworkErrorConsoleMessages > 0) {
      expectedNetworkErrorConsoleMessages -= 1;
      return;
    }
    const locationUrl = message.location().url;
    const expected = expectedHttpErrors.find((item) =>
      item.remaining > 0 && item.url === locationUrl && message.text().includes(`status of ${item.status}`)
    );
    if (expected) expected.remaining -= 1;
    else errors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    const expected = expectedRequestFailures.find((item) => item.remaining > 0 && item.url === request.url());
    if (expected) expected.remaining -= 1;
    else errors.push(`Request failed: ${request.url()} (${request.failure()?.errorText ?? 'unknown error'})`);
  });
  return {
    errors,
    expectHttpError(url: string, status: number, count = 1) {
      expectedHttpErrors.push({ url, status, remaining: count });
    },
    expectRequestFailure(url: string, count = 1) {
      expectedRequestFailures.push({ url, remaining: count });
      expectedNetworkErrorConsoleMessages += count;
    }
  };
}

export async function captureResponsiveEvidence(
  page: Page,
  directory: string,
  screen: string,
  lab = 'lab-03',
  focusSelector?: string
) {
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(200);
    await page.evaluate(() => window.scrollTo(0, 0));
    if (lab === 'lab-04' && focusSelector) {
      const feature = page.locator(focusSelector).first();
      await expect(feature).toBeVisible();
      await feature.evaluate((element) => {
        const top = element.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, top);
      });
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `${screen} must not overflow horizontally at ${viewport.width}px.`
    ).toBe(true);
    await assertAccessible(page);
    if (lab === 'lab-04') {
      await page.screenshot({
        path: `artifacts/${lab}/screenshots/${directory}/${screen}-${viewport.name}.png`
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        fullPage: true,
        path: `artifacts/${lab}/screenshots/${directory}/${screen}-${viewport.name}-full-page.png`
      });
    } else {
      await page.screenshot({
        fullPage: true,
        path: `artifacts/${lab}/screenshots/${directory}/${screen}-${viewport.name}.png`
      });
    }
  }
}
