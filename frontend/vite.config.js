import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  plugins: [react(), VitePWA({
    registerType: "autoUpdate",
    manifest: { name: "ATH Library", short_name: "ATH Library", theme_color: "#166534", background_color: "#f1f5f9", display: "standalone",
      icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }] },
  })],
});
