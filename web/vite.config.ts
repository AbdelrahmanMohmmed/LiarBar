import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    // Routes are already split (see src/App.tsx). This only sets the threshold
    // at which Vite starts warning, so a genuine regression is still noticed.
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        /**
         * Split vendor code by how often it changes, not by what it is.
         *
         * Without this, every dependency lands in the same chunk as our own
         * code — so changing one line of a game invalidates React, the router
         * and Socket.IO too, and every returning player re-downloads ~120KB
         * gzipped that did not change.
         *
         * Split this way, a normal deploy invalidates only the app chunk.
         * React and Socket.IO change a few times a year and stay in cache
         * across every deploy in between. For a product where a large share of
         * sessions are "someone opens a link on mobile data for the second
         * time this week", that is the difference between an instant load and
         * a visible one.
         *
         * Firebase is deliberately absent: it is dynamically imported inside
         * lib/firebase.ts and must stay in its own lazily-fetched chunk. Naming
         * it here would pull ~190KB back onto the critical path for every
         * visitor, the overwhelming majority of whom never sign in.
         */
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          // React and its DOM renderer change rarely and are needed always.
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) {
            return "vendor-react";
          }

          // The realtime transport — needed on every page that has a room.
          if (id.includes("socket.io-client") || id.includes("engine.io-client")) {
            return "vendor-socket";
          }

          // Router + toasts + icons: small, stable, needed everywhere.
          if (
            id.includes("react-router") ||
            id.includes("/sonner/") ||
            id.includes("lucide-react")
          ) {
            return "vendor-ui";
          }

          return undefined;
        },
      },
    },
  },
});
