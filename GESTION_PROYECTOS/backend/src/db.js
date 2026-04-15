import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";
import { POLAR_SCHOOL_PROGRESS_STACKED } from "./queries/polarSchoolProgressStacked.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const { Pool } = pg;

/**
 * Variables GCP / .env típicas: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 * Compatibilidad alternativa: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
 */
const pgHost = process.env.DB_HOST || process.env.PGHOST || "localhost";
const pgPort = Number(process.env.DB_PORT || process.env.PGPORT || 5432);
const pgDatabase = process.env.DB_NAME || process.env.PGDATABASE || "inventario";
/** pg exige password como string; undefined rompe SCRAM. */
const pgUser =
  String(process.env.DB_USER || process.env.PGUSER || "").trim() || "postgres";
const pgPassword = String(process.env.DB_PASSWORD || process.env.PGPASSWORD || "");

const useSsl =
  process.env.DB_SSL === "true" ||
  process.env.PGSSLMODE === "require" ||
  process.env.PGSSL === "true";

/** Cloud SQL desde Node suele fallar si rejectUnauthorized es true sin CA; usar false en .env solo en dev. */
const sslRejectUnauthorized =
  process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" &&
  process.env.PGSSL_REJECT_UNAUTHORIZED !== "false";

export const pool = new Pool({
  host: pgHost,
  port: pgPort,
  database: pgDatabase,
  user: pgUser,
  password: pgPassword,
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 15000),
  ssl: useSsl ? { rejectUnauthorized: sslRejectUnauthorized } : undefined,
});

pool.on("error", (err) => {
  console.error("Error en pool PostgreSQL:", err);
});

/**
 * Filas polar apiladas: school_norm (ángulo), progress_type (serie), total.
 */
export async function getRequestsBySchoolAndType() {
  const { rows } = await pool.query(POLAR_SCHOOL_PROGRESS_STACKED);
  return rows;
}
