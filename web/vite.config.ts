import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Puertos configurables desde .env (levantar.sh los exporta); por defecto 5173 → API :3000.
const api = `http://127.0.0.1:${process.env.API_PORT ?? '3000'}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: {
      '/api': api,
      '/health': api,
    },
  },
});
