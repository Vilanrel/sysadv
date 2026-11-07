import { test, expect } from '@playwright/test';

test('tela de login renderiza e oferece campos acessiveis', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /entre na sua conta/i })).toBeVisible();
  await expect(page.getByLabel(/e-mail/i)).toBeVisible();
  await expect(page.getByLabel(/^senha$/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /^entrar$/i })).toBeVisible();
});
