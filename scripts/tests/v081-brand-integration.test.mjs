import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('login uses DS brand identity with accessible image and a justice themed hero asset', () => {
  const login = read('apps/web/src/features/auth/LoginPage.tsx');
  assert.match(login, /DS Advocacia Especializada/);
  assert.match(login, /\/brand\/ds-logo\.webp/);
  assert.match(login, /login-justice-scene/);
  assert.ok(fs.existsSync(path.join(root, 'apps/web/public/brand/ds-logo.webp')));
  assert.ok(fs.existsSync(path.join(root, 'apps/web/public/brand/justice-hero.webp')));
});

test('dashboard shell carries unobtrusive justice-themed watermark and same brand asset', () => {
  const shell = read('apps/web/src/layout/AppShell.tsx');
  const css = read('apps/web/src/styles.css');
  assert.match(shell, /\/brand\/ds-logo\.webp/);
  assert.match(css, /\/brand\/justice-watermark\.svg/);
  assert.match(css, /pointer-events:\s*none/);
  assert.ok(fs.existsSync(path.join(root, 'apps/web/public/brand/justice-watermark.svg')));
});

test('layout retains mobile navigation and provides a smaller-screen login layout', () => {
  const css = read('apps/web/src/styles.css');
  const shell = read('apps/web/src/layout/AppShell.tsx');
  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
  assert.match(css, /@media\s*\(max-width:\s*720px\)/);
  assert.match(shell, /aria-expanded=\{menuOpen\}/);
});

test('models route is defined only once', () => {
  const router = read('apps/web/src/app/router.tsx');
  const matches = router.match(/path:\s*'templates'/g) ?? [];
  assert.equal(matches.length, 1, 'avoid overriding document-models page with a second route');
});

test('release declares updated version consistently', () => {
  const app = read('apps/web/src/app/version.ts');
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '0.9.0');
  assert.match(app, /0\.9\.0/);
});
