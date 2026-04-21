import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const clientPort = Number(process.env.PORT ?? 5173);

export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    outDir: 'build',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('framer-motion')) {
            return 'motion';
          }

          if (id.includes('@radix-ui')) {
            return 'radix';
          }

          if (id.includes('nostr-tools')) {
            return 'nostr';
          }

          if (id.includes('lucide-react')) {
            return 'icons';
          }

          return undefined;
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: clientPort,
    strictPort: true,
    allowedHosts: ['near-pin-rose.wm3.otherstuff.ai'],
    proxy: {
      '/api': 'http://localhost:3002',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
