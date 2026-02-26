import { expect, test } from '@playwright/test';

test('fast-booking flow reaches success in e2e mock mode', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__E2E_FASTBOOKING_MOCK__ = true;
  });

  await page.goto('/#/fast-booking');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'Continua' }).click(); // intro -> artist

  const firstArtist = page.locator('.artist').first();
  await expect(firstArtist).toBeVisible();
  await firstArtist.click();
  await page.getByRole('button', { name: 'Continua' }).click(); // artist -> when

  const firstDay = page.locator('.day').first();
  await expect(firstDay).toBeVisible();
  await firstDay.click();

  const firstTime = page.locator('.time').first();
  await expect(firstTime).toBeVisible();
  await firstTime.click();
  await page.getByRole('button', { name: 'Continua' }).click(); // when -> details

  await page.getByLabel('Nome e Cognome').fill('E2E Client');
  await page.getByLabel('Email o Telefono').fill('e2e.client@example.com');
  await page.getByLabel('Descrizione del progetto').fill('Test e2e fast booking completo');
  await page.getByRole('button', { name: 'Continua' }).click(); // details -> summary

  await expect(page.getByText('RIEPILOGO')).toBeVisible();
  await page.getByRole('button', { name: 'Continua' }).click(); // summary -> payment

  await page.getByRole('button', { name: 'Inizia pagamento' }).click();
  await page.getByTestId('e2e-mock-payment-success').click();

  await expect(page.getByText('Prenotazione confermata')).toBeVisible();
  await expect(page.getByText('Codice prenotazione:')).toBeVisible();
});
