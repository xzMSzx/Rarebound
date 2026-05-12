import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // This ensures imports like "@/components/ui/button" work properly
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    // Vercel prefers deploying from standard 'dist' folders rather than 'dist/public'
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port: 5173, // Standard local Vite port
    strictPort: false,
    host: true, // Allows the local server to run on standard localhost
  },
  preview: {
    port: 5173,
    host: true,
  },
});