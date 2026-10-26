import { defineConfig } from "vite";

// Optional: `npm run dev` here gives hot-reload on http://localhost:5173
// (the backend must also be running; /api calls are forwarded to it).
export default defineConfig({
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:5000" },
  },
});
