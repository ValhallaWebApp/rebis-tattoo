import { expect, test } from '@playwright/test';

test('home page visual baseline', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('home-page.png', { fullPage: true });
});
