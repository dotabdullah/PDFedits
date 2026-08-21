import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed port and relative asset paths.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
     watch: {
      // Ignore the Tauri Rust build output (Windows locks the .exe during dev)
      ignored: ['**/src-tauri/target/**'],
    },
    
  },
  build: {
    target: "es2021",
    outDir: "dist",
  },
});
