import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true
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
