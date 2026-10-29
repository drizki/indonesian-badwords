import { test, expect } from '@playwright/test';

test('original highlights, exceptions, safe text, incomplete checks, and recovery', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const message = page.getByLabel('Message', { exact: true });
  const quote = page.getByLabel('Quoted text');
  await expect(page.getByTestId('censored')).toHaveText('👩🏽‍💻 ***! Baju Bodo');
  await expect(page.getByTestId('highlights').locator('mark')).toHaveText(['g0bl0k']);
  expect(JSON.parse(await page.getByTestId('locations').innerText())).toEqual([
    ...['goblik', 'goblo', 'goblog'].map(word => ({ word, index: 8, end: 14, match: 'g0bl0k', via: { kind: 'fuzzy', edits: 1, model: 'osa' } })),
    { word: 'goblok', index: 8, end: 14, match: 'g0bl0k', via: { kind: 'leetspeak', folds: 2 } },
  ]);
  await quote.fill('goblok');
  await message.fill('Baju Bodo goblok bodo');
  await expect(page.getByTestId('censored')).toHaveText('goblok\nBaju Bodo *** ***');
  await expect(page.getByTestId('highlights').locator('mark')).toHaveText(['goblok', 'bodo']);
  await quote.fill('');
  await message.fill('<img src=x onerror="window.injected=true"> goblox');
  await expect(page.getByTestId('highlights')).toHaveText('<img src=x onerror="window.injected=true"> goblox');
  await expect(page.getByTestId('highlights').locator('img')).toHaveCount(0);
  await expect(page.getByTestId('censored')).toContainText('***');
  await message.fill('a'.repeat(1001));
  await expect(page.getByRole('status')).toHaveText('Check incomplete');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('censored')).toBeHidden();
  await message.fill('terima kasih');
  await expect(page.getByRole('status')).toHaveText('0 matches');
  await expect(page.getByRole('alert')).toBeHidden();
  await expect(page.getByTestId('censored')).toHaveText('terima kasih');
  expect(errors).toEqual([]);
});

test('independent app instances keep their input state', async ({ page, context }) => {
  await page.goto('/');
  const other = await context.newPage();
  await other.goto('/');
  await page.getByLabel('Message', { exact: true }).fill('goblok');
  await other.getByLabel('Message', { exact: true }).fill('terima kasih');
  await expect(page.getByTestId('censored')).toHaveText('***');
  await expect(other.getByTestId('censored')).toHaveText('terima kasih');
  await other.close();
});
