import { defineConfig } from "vite";

// `vite`                     -> demo dev server
// `vite build --mode demo`   -> demo app build (demo-dist/)
// `vite build`               -> the library (dist/)
export default defineConfig(({ mode }) => ({
  build:
    mode === "demo"
      ? { outDir: "demo-dist" }
      : {
          lib: {
            entry: "src/lib/index.js",
            formats: ["es", "cjs"],
            fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
            cssFileName: "style"
          },
          rollupOptions: {
            external: [/^react($|\/)/, /^react-dom($|\/)/, /^react-window($|\/)/]
          }
        }
}));
