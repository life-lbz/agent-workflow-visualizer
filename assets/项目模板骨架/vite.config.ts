import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite 配置
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  optimizeDeps: {
    // Pyodide 和 MuPDF 体积大，排除预构建，运行时动态加载
    exclude: ["pyodide", "@mupdf/mupdf"],
  },
  // Pyodide WASM 文件需要正确放置
  // 默认 import("pyodide") 会从 node_modules/pyodide/ 加载 WASM
  // 如果部署到静态托管，可能需要把 WASM 文件复制到 public/ 目录
  assetsInclude: ["**/*.wasm"],
});
