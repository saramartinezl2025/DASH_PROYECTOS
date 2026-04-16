import cors from "cors";
import express from "express";
import { connectivityHintEs, isConnectivityError } from "./dbConnectivity.js";
import { pool } from "./db.js";
import { isDemoOnDbFailure, isOfflineDemo, sendDemoJson } from "./demoMode.js";
import { OFFLINE_DEMO_DIAS_VENCIMIENTO, OFFLINE_DEMO_SERIE_TIEMPO } from "./mocks/dashboardOfflineDemo.js";
import { DIAS_VENCIMIENTO_HISTOGRAM } from "./queries/diasVencimientoHistogram.js";
import { DETALLE_PROYECTOS } from "./queries/detalleProyectos.js";
import { parseSoloVencidasQuery } from "./parseSoloVencidas.js";
import { SERIE_TIEMPO_PROYECTOS, SERIE_TIEMPO_PROYECTOS_VENCIDAS } from "./queries/serieTiempoProyectos.js";
import { dashboardRouter } from "./routes/dashboard.js";

const app = express();
const port = Number(process.env.PORT ?? 3030);

app.use(cors());
app.use(express.json());

const hideErrorDetails = process.env.API_HIDE_ERROR_DETAILS === "true";

/** Evita que /health cuelgue el navegador si PostgreSQL no conecta (Cloud SQL, red, credenciales). */
const healthDbTimeoutMs = Number(process.env.HEALTH_DB_TIMEOUT_MS ?? 8_000);

/** El puerto 3030 es solo el API; el tablero web vive en Vite (p. ej. :5177). */
app.get("/", (_req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Gestión de Proyectos — API</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #1a1a1a; }
    h1 { font-size: 1.25rem; }
    ul { padding-left: 1.25rem; }
    a { color: #1565c0; }
    .note { background: #e3f2fd; border-radius: 8px; padding: 0.75rem 1rem; margin-top: 1.25rem; font-size: 0.9375rem; }
  </style>
</head>
<body>
  <h1>API Gestión de Proyectos</h1>
  <p>Esta dirección es el <strong>backend</strong> (Express). No hay página del tablero aquí.</p>
  <p>Enlaces útiles:</p>
  <ul>
    <li><a href="/ping">/ping</a> — comprobación rápida (sin base de datos)</li>
    <li><a href="/health">/health</a> — estado y prueba de PostgreSQL (JSON; si la BD falla, <code>ok: false</code> con HTTP 200 para que el navegador no muestre error genérico). Monitorización: <a href="/health?strict=1"><code>?strict=1</code></a> → 503 si no hay BD.</li>
    <li><a href="/api/dashboard/kpis">/api/dashboard/kpis</a> — KPIs (JSON)</li>
  </ul>
  <div class="note">
    Para ver el <strong>tablero en el navegador</strong>, ejecuta el frontend (<code>npm run dev</code> en la carpeta <code>frontend</code>)
    y abre la URL que muestre Vite (por defecto <code>http://localhost:5177</code>), o desde la raíz del proyecto: <code>npm run dev</code>.
  </div>
</body>
</html>`);
});

app.get("/ping", (_req, res) => {
  res.json({ ok: true, service: "gestion-proyectos-api" });
});

/**
 * Por defecto, si PostgreSQL no responde se devuelve HTTP 200 con `{ ok: false, ... }` para que Chrome/Edge
 * muestren el JSON en lugar de “This page isn’t working” (503). Para balanceadores o probes: `/health?strict=1`.
 */
app.get("/health", async (req, res) => {
  const strict =
    req.query.strict === "1" ||
    req.query.strict === "true" ||
    process.env.HEALTH_HTTP_STRICT === "true";

  if (isOfflineDemo()) {
    res.json({
      ok: true,
      database: "offline_demo",
      hint: "API_OFFLINE_DEMO=true: tablero con datos de ejemplo; PostgreSQL no se comprueba aquí.",
    });
    return;
  }
  try {
    await Promise.race([
      pool.query("SELECT 1"),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            Object.assign(
              new Error(
                `PostgreSQL no respondió en ${healthDbTimeoutMs} ms (revisa red, IP autorizada en Cloud SQL y .env)`,
              ),
              { code: "HEALTH_DB_TIMEOUT" },
            ),
          );
        }, healthDbTimeoutMs);
      }),
    ]);
    res.json({ ok: true, database: "connected" });
  } catch (err) {
    const body = {
      ok: false,
      database: "unavailable",
      ...(!hideErrorDetails && {
        message: err.message,
        ...(err.code && { code: err.code }),
        ...(isConnectivityError(err) && { hint: connectivityHintEs() }),
      }),
    };
    if (strict) res.status(503).json(body);
    else res.status(200).json(body);
  }
});

app.use("/api/dashboard", dashboardRouter);

app.get("/api/detalle-proyectos", async (_req, res, next) => {
  try {
    if (isOfflineDemo()) {
      sendDemoJson(res, []);
      return;
    }
    const { rows } = await pool.query(DETALLE_PROYECTOS);
    res.json(rows);
  } catch (err) {
    if (isDemoOnDbFailure() && isConnectivityError(err)) {
      console.warn("[api/detalle-proyectos] demo por fallo de red:", err.code);
      sendDemoJson(res, [], "db_unreachable");
      return;
    }
    next(err);
  }
});

app.get("/api/serie-tiempo-proyectos", async (req, res, next) => {
  try {
    if (isOfflineDemo()) {
      const rows = parseSoloVencidasQuery(req)
        ? OFFLINE_DEMO_SERIE_TIEMPO.filter((r) => r.past)
        : OFFLINE_DEMO_SERIE_TIEMPO;
      sendDemoJson(res, rows);
      return;
    }
    const sql = parseSoloVencidasQuery(req) ? SERIE_TIEMPO_PROYECTOS_VENCIDAS : SERIE_TIEMPO_PROYECTOS;
    const { rows } = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    if (isDemoOnDbFailure() && isConnectivityError(err)) {
      console.warn("[api/serie-tiempo-proyectos] demo por fallo de red:", err.code);
      const rows = parseSoloVencidasQuery(req)
        ? OFFLINE_DEMO_SERIE_TIEMPO.filter((r) => r.past)
        : OFFLINE_DEMO_SERIE_TIEMPO;
      sendDemoJson(res, rows, "db_unreachable");
      return;
    }
    next(err);
  }
});

app.get("/api/dias-vencimiento", async (_req, res, next) => {
  try {
    if (isOfflineDemo()) {
      sendDemoJson(res, OFFLINE_DEMO_DIAS_VENCIMIENTO);
      return;
    }
    const { rows } = await pool.query(DIAS_VENCIMIENTO_HISTOGRAM);
    res.json(rows);
  } catch (err) {
    if (isDemoOnDbFailure() && isConnectivityError(err)) {
      console.warn("[api/dias-vencimiento] demo por fallo de red:", err.code);
      sendDemoJson(res, OFFLINE_DEMO_DIAS_VENCIMIENTO, "db_unreachable");
      return;
    }
    next(err);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  /** Errores `pg` suelen traer code (5 chars), detail, hint */
  const pgExtra =
    err && typeof err.code === "string" && /^[0-9A-Z]{5}$/.test(err.code)
      ? {
          ...(err.detail && { detail: String(err.detail) }),
          ...(err.hint && { hint: String(err.hint) }),
        }
      : null;

  const connectivity = isConnectivityError(err);
  const status = connectivity ? 503 : 500;

  res.status(status).json({
    error: connectivity ? "Base de datos no disponible" : "Error interno del servidor",
    ...(!hideErrorDetails && {
      message: err.message,
      ...(err.code && { code: err.code }),
      ...(connectivity && { hint: connectivityHintEs() }),
      ...(pgExtra && Object.keys(pgExtra).length ? pgExtra : {}),
    }),
  });
});

const server = app.listen(port, () => {
  console.log(`API http://localhost:${port}`);
  console.log(`Ping (sin BD) http://localhost:${port}/ping`);
  console.log(`Salud + BD http://localhost:${port}/health`);
  console.log(`KPIs http://localhost:${port}/api/dashboard/kpis`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Puerto ${port} en uso. Cierra el otro proceso (p. ej. otra terminal con npm run dev) o usa PORT=3040 en .env`,
    );
    process.exit(1);
  } else {
    console.error(err);
  }
});

/** Consultas lentas (p. ej. KPIs + Cloud SQL): evitar cierre prematuro del socket HTTP */
const httpTimeoutMs = Number(process.env.HTTP_SERVER_TIMEOUT_MS ?? 120_000);
server.headersTimeout = httpTimeoutMs + 5_000;
server.requestTimeout = httpTimeoutMs;
