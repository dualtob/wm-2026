import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/wm-2026/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "World Cup 2026",
        short_name: "WC 2026",
        description: "FIFA World Cup 2026 match tracker and live scores",
        theme_color: "#0a9d72",
        background_color: "#0d0f13",
        display: "standalone",
        orientation: "portrait",
        start_url: "/wm-2026/",
        scope: "/wm-2026/",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\//,
            handler: "CacheFirst",
            options: {
              cacheName: "flags-cache",
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/site\.api\.espn\.com\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "espn-cache",
              expiration: { maxAgeSeconds: 60 },
            },
          },
          {
            urlPattern: /^https:\/\/sports\.core\.api\.espn\.com\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "espn-core-cache",
              expiration: { maxAgeSeconds: 300 },
            },
          },
          {
            urlPattern: /^https:\/\/a\.espncdn\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "espn-images",
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "fixtures-cache",
              expiration: { maxAgeSeconds: 300 },
            },
          },
          {
            urlPattern: /^https:\/\/gamma-api\.polymarket\.com\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "polymarket-cache",
              expiration: { maxAgeSeconds: 600 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  server: {
    port: 5173,
  },
});
