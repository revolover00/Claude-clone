import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), viteSingleFile({
    useRecommendedBuildConfig: false,
    inlinePattern: ["assets/app-*.js", "assets/*.css"],
  })],
  build: {
    assetsDir: "assets",
    cssCodeSplit: false,
    rollupOptions: { output: {
      inlineDynamicImports: false,
      entryFileNames: "assets/app-[hash].js",
      chunkFileNames: "assets/[name]-[hash].js",
    } },
  },
  server: {
    port: 3000,
    host: true,
    hmr: false,
    // Vite rejects unknown Host headers (DNS-rebinding protection). Allow the
    // sandbox preview proxy (https://3000-<sandbox-id>.e2b.app); localhost and
    // IP addresses are always allowed.
    allowedHosts: [".e2b.app"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
