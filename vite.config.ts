import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Plugin to remove crossorigin from stylesheet links (fixes Electron file:// protocol)
function removeStylesheetCrossorigin() {
  return {
    name: 'remove-stylesheet-crossorigin',
    transformIndexHtml(html: string) {
      return html.replace(/<link rel="stylesheet" crossorigin/g, '<link rel="stylesheet"');
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), removeStylesheetCrossorigin()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Fixed filenames (no content hashes) so update patches are predictable
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return 'assets/index.css';
          return 'assets/[name][extname]';
        },
      },
    },
  },
})
