import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true
  },
  // ── Vitest configuration ────────────────────────────────────────────────
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/__tests__/**', 'src/main.jsx'],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Optimize chunk splitting for better caching and loading
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk - core React dependencies
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Auth0 chunk
          'vendor-auth0': ['@auth0/auth0-react'],
          // Charts chunk - heavy library
          'vendor-charts': ['recharts'],
          // UI utilities
          'vendor-ui': ['lucide-react', 'axios'],
        },
      },
    },
    // Increase warning limit since we're now chunking properly
    chunkSizeWarningLimit: 600,
  },
})
