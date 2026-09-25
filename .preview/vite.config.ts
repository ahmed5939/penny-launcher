import { defineConfig } from "vite"
import react from "@vitejs/plugin-react-swc"
export default defineConfig({ root: process.cwd(), plugins: [react()], server: { port: 5240, strictPort: true, proxy: { "/pennydb-api": { target: "https://pennydb.net", changeOrigin: true, rewrite: (path) => path.replace(/^\/pennydb-api/, "/api") } } }, resolve: { preserveSymlinks: true }, clearScreen: false, optimizeDeps: { entries: [".preview/app.html"] } })
