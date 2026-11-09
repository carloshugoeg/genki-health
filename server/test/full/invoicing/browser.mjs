import process from 'node:process';
import console from 'node:console';
/** Standalone browser smoke; no global router edits and no auth changes. */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const scratch = resolve(repo, '../work');
await mkdir(scratch, { recursive: true });
const root = await mkdtemp(resolve(scratch, 'lane-a-ui-'));
const pages = ['charges', 'personnel', 'inventory', 'honoraria', 'invoicing', 'payments'];
await writeFile(
  resolve(root, 'index.html'),
  '<!doctype html><html lang="es"><meta charset="utf-8"><title>Lane A</title><div id="root"></div><script type="module" src="/main.tsx"></script></html>',
);
await writeFile(
  resolve(root, 'main.tsx'),
  `
import { createRoot } from 'react-dom/client';
${pages.map((slug) => `import { ${slug[0].toUpperCase() + slug.slice(1)}Page } from '${repo}/web/src/full/${slug}/index.tsx';`).join('\n')}
window.calls=[];
const client=async(path,init)=>{window.calls.push({path,...init});if(path.endsWith('/preview'))return {cargos:[{id_cargo:1,descripcion:'Consulta',subtotal:'100.00'}],subtotal:'100.00',impuesto:'12.00',total:'112.00',preview_hash:'frozen-preview'};if(path.endsWith('/facturas'))return {factura:{serie:'A',numero:1,total:'112.00',saldo_pendiente:'112.00'}};return {items:[],total:0};};
const slug=new URLSearchParams(location.search).get('page')||'charges';const Component={${pages.map((s) => `${s}:${s[0].toUpperCase() + s.slice(1)}Page`).join(',')}}[slug];createRoot(document.getElementById('root')).render(<Component client={client}/>);
`,
);
const server = await createServer({
  root,
  esbuild: { jsx: 'automatic' },
  optimizeDeps: {
    include: ['react', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: resolve(repo, 'node_modules/react'),
      'react-dom': resolve(repo, 'node_modules/react-dom'),
    },
  },
  server: { host: '127.0.0.1', port: 0, fs: { allow: [repo, root] } },
});
let browser;
try {
  await server.listen();
  const url = server.resolvedUrls.local[0];
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const [slug, title] of Object.entries({
    charges: 'Cargos y tarifario',
    personnel: 'Personal y tarifas',
    inventory: 'Inventario',
    honoraria: 'Honorarios',
    invoicing: 'Facturación',
    payments: 'Caja y pagos',
  })) {
    await page.goto(`${url}?page=${slug}`);
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
  }
  await page.goto(`${url}?page=invoicing`);
  await page.getByLabel('Paciente').fill('1');
  await page.getByLabel('Cargos separados por coma').fill('1');
  await page.getByRole('button', { name: 'Previsualizar', exact: true }).click();
  await page.getByRole('cell', { name: 'Consulta', exact: true }).waitFor();
  await page.getByLabel('Serie').fill('A');
  await page.getByLabel('Nombre receptor').fill('Académico');
  await page.getByLabel('NIT').fill('CF');
  await page.getByRole('button', { name: 'Emitir factura', exact: true }).click();
  await page.getByRole('status').waitFor();
  const calls = await page.evaluate(() => globalThis.window.calls);
  assert.equal(JSON.parse(calls[1].body).preview_hash, 'frozen-preview');
  assert.deepEqual(JSON.parse(calls[1].body).cargo_ids, [1]);
  assert.deepEqual(errors, []);
  console.log(
    'Browser OK: six standalone pages and preview → invoice with immutable selection/hash.',
  );
} finally {
  await browser?.close();
  await server.close();
  await rm(root, { recursive: true, force: true });
}
