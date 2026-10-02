import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "src/editor",
  base: "./",
  plugins: [react()],
  build: { outDir: "../../skills/flowchart/scripts/editor", emptyOutDir: true, chunkSizeWarningLimit: 2000 },
});
