import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: { outDir: "dist", emptyOutDir: true, target: "es2022" },
  server: { port: 5173 },
  plugins: [
    VitePWA({
      // registration happens in src/main.js so no inline script is injected (the CSP forbids inline scripts)
      injectRegister: null,
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png"],
      manifest: {
        name: "pupper supper",
        short_name: "pupper supper",
        description: "Plan a dog's daily diet and check it against the AAFCO adult-maintenance nutrient profile.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#FAFAF7",
        theme_color: "#22382E",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // the app shell is precached; USDA requests and Google Fonts are fetched live and never cached
        globPatterns: ["**/*.{js,css,html,png,webmanifest}"],
        navigateFallback: "/index.html",
        runtimeCaching: [],
      },
    }),
  ],
});
