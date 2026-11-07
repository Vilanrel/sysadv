import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const user = process.env.TEST_ADMIN_EMAIL;
const password = process.env.TEST_ADMIN_PASSWORD;
if (!user || !password) throw new Error('TEST_ADMIN_EMAIL e TEST_ADMIN_PASSWORD obrigatorios em homologacao');
const shots = process.env.QA_SCREENSHOT_DIR || '/tmp/sysadv-qa-screenshots';
mkdirSync(shots, { recursive: true });

const pages: Array<[string, string]> = [
  ['/', 'dashboard'], ['/people', 'clientes'], ['/intakes', 'atendimentos'],
  ['/processes', 'processos'], ['/processes/new', 'processos-novo'],
  ['/agenda', 'agenda'], ['/deadlines', 'gerenciador-prazos'], ['/publications', 'publicacoes'],
  ['/tasks', 'tarefas'], ['/kanban', 'kanban'], ['/finance', 'financeiro'],
  ['/agreements', 'contratos'], ['/timesheets', 'timesheet'], ['/reports', 'relatorios'],
  ['/documents', 'documentos'], ['/templates', 'modelos'], ['/calculations', 'calculos'],
  ['/sources', 'fontes'], ['/integrations', 'integracoes-judiciais'],
  ['/admin', 'administracao'], ['/settings', 'configuracoes'],
  ['/audit', 'auditoria'], ['/users', 'usuarios']
];
async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/e-mail/i).fill(user!);
  await page.getByLabel(/^senha$/i).fill(password!);
  await page.getByRole('button', { name: /^entrar$/i }).click();
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
}

test('todas as 23 rotas renderizam sem falha no navegador', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('response', resp => {
    if (resp.url().includes('/api/') && resp.status() >= 500) errors.push(`API ${resp.status()}: ${new URL(resp.url()).pathname}`);
  });
  await login(page);
  for (const [path, name] of pages) {
    const before = errors.length;
    await page.goto(path);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#main-content')).not.toBeEmpty();
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(shots, `${name}-desktop.png`), fullPage: true });
    expect(errors.slice(before), `${name}: erro no frontend/API`).toEqual([]);
  }
});

test('clientes, processos, financeiro e outros modulos cabem no celular', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  for (const [path, name] of pages) {
    await page.goto(path);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(200);
    const widths = await page.evaluate(() => ({ viewport: window.innerWidth, doc: document.documentElement.scrollWidth }));
    expect(widths.doc, `Rolagem horizontal global em ${name}`).toBeLessThanOrEqual(widths.viewport + 1);
    await page.screenshot({ path: join(shots, `${name}-mobile.png`), fullPage: true });
  }
  const toggle = page.getByRole('button', { name: 'Abrir menu' });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Fechar menu', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Fechar menu', exact: true })).not.toBeVisible();
});

test('detalhe e edicao de processo ficam acessiveis', async ({ page }) => {
  await login(page);
  await page.goto('/processes');
  const first = page.locator('table tbody tr td:first-child a[href^="/processes/"]').first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page.locator('#main-content')).not.toBeEmpty();
  await page.screenshot({ path: join(shots, 'processo-detalhe-desktop.png'), fullPage: true });
  await page.goto('/processes');
  const edit = page.locator('table tbody tr a[href$="/edit"]').first();
  await expect(edit).toBeVisible();
  await edit.click();
  await expect(page.locator('#main-content')).not.toBeEmpty();
});
