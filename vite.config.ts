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
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
            if (id.includes('react-router')) return 'router-vendor';
            if (id.includes('framer-motion')) return 'motion-vendor';
            if (id.includes('recharts/es6/chart') || id.includes('recharts/es6/cartesian') || id.includes('recharts/es6/component/Tooltip') || id.includes('recharts/es6/component/ResponsiveContainer')) return 'charts-core-vendor';
            if (id.includes('recharts/es6/polar') || id.includes('recharts/es6/component/Legend')) return 'charts-polar-vendor';
            if (id.includes('recharts')) return 'charts-vendor';
            if (id.includes('tesseract.js')) return 'ocr-vendor';
            if (id.includes('pdf-parse')) return 'pdf-vendor';
            if (id.includes('mammoth')) return 'docx-vendor';
            if (id.includes('jspdf')) return 'jspdf-vendor';
            if (id.includes('html2canvas')) return 'html2canvas-vendor';
            if (id.includes('zustand')) return 'state-vendor';
            if (id.includes('canvas-confetti')) return 'effects-vendor';
            if (id.includes('lucide-react') || id.includes('@dnd-kit')) return 'ui-vendor';
            return 'vendor';
          }
        },
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
