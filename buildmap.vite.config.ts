import { defineConfig } from 'vite';
import { worldRelease } from './tools/release';

export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      preserveEntrySignatures: 'strict',
      input: { journal: './src/journal/index.html', npc: './src/npc/index.html', 'src-main': './src/main.ts' },
    },
  },
  preview: { cors: true },
  plugins: [worldRelease()],
});
