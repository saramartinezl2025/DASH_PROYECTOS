import cors from "cors";
import express from "express";
import { pool } from "./db.js";
import { dashboardRouter } from "./routes/dashboard.js";

const app = express();
const port = Number(process.env.PORT ?? 3030);

app.use(cors());
app.use(express.json());

const hideErrorDetails = process.env.API_HIDE_ERROR_DETAILS === "true";

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (err) {
    res.status(503).json({
      ok: false,
      database: "unavailable",
      ...(!hideErrorDetails && {
        message: err.message,
        ...(err.code && { code: err.code }),
      }),
    });
  }
});

app.use("/api/dashboard", dashboardRouter);

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

  res.status(500).json({
    error: "Error interno del servidor",
    ...(!hideErrorDetails && {
      message: err.message,
      ...(err.code && { code: err.code }),
      ...(pgExtra && Object.keys(pgExtra).length ? pgExtra : {}),
    }),
  });
});

app.listen(port, () => {
  console.log(`API http://localhost:${port}`);
  console.log(`KPIs http://localhost:${port}/api/dashboard/kpis`);
});
