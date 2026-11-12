import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: { enabled: true },
        workbox: {
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ttf}']
        },
        manifest: {
          id: 'ahmed-and-hamdy-accounts',
          name: 'Ahmed and hamdy - إدارة الحسابات',
          short_name: 'Ahmed & Hamdy',
          description: 'نظام متكامل لإدارة الحسابات والمعاملات المالية والقيود مع العمل بدون إنترنت والمزامنة السحابية.',
          display: 'standalone',
          orientation: 'portrait',
          start_url: './',
          scope: './',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          dir: 'rtl',
          lang: 'ar',
          icons: [
            { src: 'app-icon.png', sizes: '192x192', type: 'image/png' },
            { src: 'app-icon.png', sizes: '512x512', type: 'image/png' },
            { src: 'app-icon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
          ]
        }
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
