import { defineConfig } from 'vite';

// host: true binds 0.0.0.0 so the UI is reachable from other machines on the LAN as well as localhost.
export default defineConfig({
  // In dev, /api is served by server/server.ts on :8787 (started by `npm run dev`).
  server: { host: true, port: 5173, proxy: { '/api': 'http://127.0.0.1:8787' } },
  preview: { host: true, port: 4173 },
});
