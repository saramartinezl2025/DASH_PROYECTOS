import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";
import {
  POLAR_SCHOOL_PROGRESS_STACKED,
  POLAR_SCHOOL_PROGRESS_STACKED_VENCIDAS,
} from "./queries/polarSchoolProgressStacked.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** `override: true` evita que DB_HOST/PGHOST viejos en variables de entorno de Windows tapen el `backend/.env`. */
dotenv.config({ path: path.join(__dirname, "..", ".env"), override: true });

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

/** Cloud SQL / redes lentas:15s suele ser poco; sube con DB_CONNECT_TIMEOUT_MS en .env */
const connectTimeout = Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 60000);

export const pool = new Pool({
  host: pgHost,
  port: pgPort,
  database: pgDatabase,
  user: pgUser,
  password: pgPassword,
  connectionTimeoutMillis: connectTimeout,
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30_000),
  keepAlive: true,
  ssl: useSsl ? { rejectUnauthorized: sslRejectUnauthorized } : undefined,
});

console.info(`[db] PostgreSQL configurado: ${pgHost}:${pgPort}/${pgDatabase}`);

pool.on("error", (err) => {
  console.error("Error en pool PostgreSQL:", err);
});

/**
 * Filas polar apiladas: school_norm (ángulo), progress_type (serie), total.
 */
export async function getRequestsBySchoolAndType(soloVencidas = false) {
  const sql = soloVencidas ? POLAR_SCHOOL_PROGRESS_STACKED_VENCIDAS : POLAR_SCHOOL_PROGRESS_STACKED;
  const { rows } = await pool.query(sql);
  return rows;
}
