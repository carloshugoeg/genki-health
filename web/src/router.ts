export const MVP_PATHS = [
  '/login',
  '/pacientes',
  '/pacientes/nuevo',
  '/pacientes/:id',
  '/pacientes/:id/consulta/nueva',
] as const;
export function route(
  path: string,
): 'login' | 'patients' | 'register' | 'record' | 'consultation' | 'unknown' {
  if (path === '/login') return 'login';
  if (path === '/pacientes') return 'patients';
  if (path === '/pacientes/nuevo') return 'register';
  if (/^\/pacientes\/[1-9]\d*$/.test(path)) return 'record';
  if (/^\/pacientes\/[1-9]\d*\/consulta\/nueva$/.test(path)) return 'consultation';
  return 'unknown';
}
export function navigate(path: string, replace = false): void {
  window.history[replace ? 'replaceState' : 'pushState'](null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
