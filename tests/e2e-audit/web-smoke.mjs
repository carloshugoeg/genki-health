#!/usr/bin/env node
// Smoke de la web con Playwright: login por institución, recorre pantallas y registra
// errores de consola, respuestas HTTP >= 400 (excepto 401/403 esperadas) y si aparece el aviso de "persistencia".
// Uso: node tests/e2e-audit/web-smoke.mjs  (GENKI_WEB default http://localhost:5173)
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'results');
mkdirSync(OUT, { recursive: true });
const WEB = process.env.GENKI_WEB ?? 'http://localhost:5173';
const PASS = process.env.GENKI_PASS ?? 'admin123!';
const INST = [
  [1, 'hospital_general'],
  [2, 'centro_pediatrico'],
  [3, 'laboratorio_clinico'],
  [4, 'clinica_odontologica'],
];
const PAGES = [
  '/inicio',
  '/pacientes',
  '/pacientes/nuevo',
  '/pacientes/101',
  '/agenda',
  '/economia',
  '/inventario',
  '/honorarios',
  '/facturacion',
  '/caja',
  '/personal',
  '/procedimientos',
  '/sesiones-dentales',
  '/cuenta',
  '/usuarios',
];
const report = [];
const browser = await chromium.launch();
for (const [n, kind] of INST) {
  for (const role of ['administrador', 'medico']) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const issues = [];
    page.on('console', (m) => {
      if (m.type() === 'error')
        issues.push({ type: 'console', text: m.text().slice(0, 200), url: page.url() });
    });
    page.on('pageerror', (e) =>
      issues.push({ type: 'pageerror', text: String(e).slice(0, 200), url: page.url() }),
    );
    page.on('response', (r) => {
      if (r.url().includes('/api/') && r.status() >= 400 && ![401, 403].includes(r.status()))
        issues.push({
          type: 'http',
          status: r.status(),
          url: r.url().replace(WEB, ''),
          at: page.url(),
        });
    });
    await page.goto(`${WEB}/login`);
    await page.fill('input[name=email]', `demo-${n}-${role}@example.invalid`);
    await page.fill('input[name=password]', PASS);
    await page.selectOption('[data-testid=login-institution]', kind);
    await page.click('[data-testid=login-submit]');
    await page
      .waitForURL(/\/(inicio|panel)/, { timeout: 15000 })
      .catch(() => issues.push({ type: 'login', text: 'no redirigió tras login' }));
    const banner = (await page.content()).includes('persistencia depende del servidor');
    for (const p of PAGES) {
      await page.goto(`${WEB}${p}`);
      await page.waitForLoadState('networkidle').catch(() => {});
    }
    report.push({ n, kind, role, banner, issues });
    console.log(`${kind}/${role}: banner=${banner} issues=${issues.length}`);
    for (const i of issues) console.log('   ', JSON.stringify(i));
    await ctx.close();
  }
}
await browser.close();
writeFileSync(join(OUT, 'web-smoke.json'), JSON.stringify(report, null, 2));
