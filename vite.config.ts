import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";

export default defineConfig({
  plugins: [react(), themePlugin()],
  base: process.env.GITHUB_PAGES === "true" ? "/file-manager/" : "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      db: path.resolve(__dirname, "db"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const prefix =
            process.env.GITHUB_PAGES === "true"
              ? "file-manager/assets"
              : "assets";
          return `${prefix}/[name]-[hash][extname]`;
        },
        chunkFileNames: (chunkInfo) => {
          const prefix =
            process.env.GITHUB_PAGES === "true"
              ? "file-manager/assets"
              : "assets";
          return `${prefix}/[name]-[hash].js`;
        },
        entryFileNames: (chunkInfo) => {
          const prefix =
            process.env.GITHUB_PAGES === "true"
              ? "file-manager/assets"
              : "assets";
          return `${prefix}/[name]-[hash].js`;
        },
      },
    },
  },
});
