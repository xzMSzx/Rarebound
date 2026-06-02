import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const pkg = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf-8"));

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    {
      name: "version-json",
      configureServer(server) {
        server.middlewares.use("/version.json", (req, res) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ version: pkg.version, buildTimestamp: new Date().toISOString() }));
        });
      },
      writeBundle() {
        fs.writeFileSync(
          path.resolve(import.meta.dirname, "dist/version.json"),
          JSON.stringify({ version: pkg.version, buildTimestamp: new Date().toISOString() }, null, 2)
        );
      }
    }
  ],
  
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