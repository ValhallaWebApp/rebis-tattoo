import { expect, test } from '@playwright/test';

test.describe('route guards', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('redirects unauthenticated user from dashboard to login', async ({ page }) => {
    await page.goto('/#/dashboard/booking-history');
    await expect(page).toHaveURL(/#\/login$/);
  });

  test('redirects unauthenticated user from staff to login', async ({ page }) => {
    await page.goto('/#/staff');
    await expect(page).toHaveURL(/#\/login$/);
  });

  test('redirects unauthenticated user from admin to login', async ({ page }) => {
    await page.goto('/#/admin');
    await expect(page).toHaveURL(/#\/login$/);
  });
});
