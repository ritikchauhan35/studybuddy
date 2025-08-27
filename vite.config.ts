import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { viteSourceLocator } from "@metagptx/vite-plugin-source-locator";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/", // Set the base URL to fix 404 errors for assets
  server: {
    // Allow ngrok hosts
    hmr: {
      // Only use clientPort in production
      clientPort: mode === 'production' ? 443 : undefined
    },
    allowedHosts: ["localhost", "5de86ca8d72f.ngrok-free.app", ".ngrok-free.app", ".vercel.app"]
  },
  plugins: [
    viteSourceLocator({
      prefix: "mgx",
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
