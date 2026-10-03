import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Usa el código fuente de la librería: no hace falta compilarla y los cambios se ven al instante.
    alias: { 'typed-forms': fileURLToPath(new URL('../../src/index.ts', import.meta.url)) },
  },
});
