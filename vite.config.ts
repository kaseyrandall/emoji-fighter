import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Share-card tags in index.html need absolute URLs. Netlify provides the
  // site's primary URL as `URL` at build time; locally it's empty and the
  // tags fall back to relative paths.
  const siteUrl = (loadEnv(mode, '.', '').URL ?? '').replace(/\/$/, '');
  return {
    plugins: [
      react(),
      { name: 'site-url', transformIndexHtml: (html: string) => html.replaceAll('%SITE_URL%', siteUrl) },
    ],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    build: {
      // three.js is big but changes rarely: keep it in its own long-cached chunk.
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks: {
            three: ['three', '@react-three/fiber'],
          },
        },
      },
    },
  };
});
