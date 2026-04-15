import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:3030";

  return {
    plugins: [
      react({
        jsxRuntime: "automatic",
        jsxImportSource: "react",
      }),
    ],
    server: {
      port: 5177,
      strictPort: false,
      host: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          timeout: 60_000,
          proxyTimeout: 60_000,
          configure(proxy) {
            proxy.on("error", (err, _req, res) => {
              if (!res || res.headersSent || typeof res.writeHead !== "function") {
                return;
              }
              const code = err?.code || "";
              const isRefused =
                code === "ECONNREFUSED" ||
                code === "ECONNRESET" ||
                code === "ETIMEDOUT";
              const message = isRefused
                ? `No hay API en ${apiTarget}. Abre otra terminal, carpeta backend, y ejecuta: npm run dev`
                : err?.message || "Error al conectar con el API";
              res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
              res.end(
                JSON.stringify({
                  error: "API no disponible",
                  message,
                  ...(code ? { code } : {}),
                }),
              );
            });
          },
        },
      },
    },
  };
});
