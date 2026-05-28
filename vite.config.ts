import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const target =
    loadEnv(mode, process.cwd(), "").VITE_API_PROXY_TARGET ||
    "http://localhost:8080";
  // 业务后端 /api/v1/* 与 OAuth 登录回调走同一后端,统一代理。
  const proxyEntry = { target, changeOrigin: true };

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: 5273,
      proxy: { "/api": proxyEntry, "/auth": proxyEntry },
    },
  };
});
