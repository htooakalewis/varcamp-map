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
      output: { entryFileNames: chunk => chunk.name === 'lyra' ? 'bots/lyra.js' : 'assets/[name]-[hash].js' },
      input: { journal: './src/journal/index.html', npc: './src/npc/index.html', 'src-main': './src/main.ts', lyra: './src/bots/lyra.ts' },
    },
  },
  preview: { cors: true },
  plugins: [worldRelease()],
});
