import { defineConfig } from "vite"
export default defineConfig({ root: process.cwd(), server: { port: 5240 }, resolve: { preserveSymlinks: true } })
