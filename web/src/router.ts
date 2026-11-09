export const MVP_PATHS = [
  '/login',
  '/panel',
  '/pacientes',
  '/pacientes/nuevo',
  '/pacientes/:id',
  '/pacientes/:id/consulta/nueva',
  '/agenda',
  '/economia',
  '/inventario',
  '/honorarios',
  '/facturacion',
  '/caja',
  '/personal',
] as const;

export type AppRoute =
  | 'login'
  | 'panel'
  | 'patients'
  | 'register'
  | 'record'
  | 'consultation'
  | 'agenda'
  | 'economia'
  | 'inventario'
  | 'honorarios'
  | 'facturacion'
  | 'caja'
  | 'personal'
  | 'unknown';

export function route(path: string): AppRoute {
  if (path === '/login') return 'login';
  if (path === '/panel') return 'panel';
  if (path === '/pacientes') return 'patients';
  if (path === '/pacientes/nuevo') return 'register';
  if (path === '/agenda') return 'agenda';
  if (path === '/economia') return 'economia';
  if (path === '/inventario') return 'inventario';
  if (path === '/honorarios') return 'honorarios';
  if (path === '/facturacion') return 'facturacion';
  if (path === '/caja') return 'caja';
  if (path === '/personal') return 'personal';
  if (/^\/pacientes\/[1-9]\d*$/.test(path)) return 'record';
  if (/^\/pacientes\/[1-9]\d*\/consulta\/nueva$/.test(path)) return 'consultation';
  return 'unknown';
}

export function navigate(path: string, replace = false): void {
  window.history[replace ? 'replaceState' : 'pushState'](null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
