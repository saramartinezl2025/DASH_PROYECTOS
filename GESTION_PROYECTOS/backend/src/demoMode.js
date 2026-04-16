/**
 * Tablero sin PostgreSQL: datos de ejemplo. Activa con API_OFFLINE_DEMO=true en backend/.env
 */
export function isOfflineDemo() {
  return process.env.API_OFFLINE_DEMO === "true";
}

/** Si la BD no responde por red (ETIMEDOUT, etc.), devolver mocks como en modo offline. */
export function isDemoOnDbFailure() {
  return process.env.API_DEMO_ON_DB_FAILURE === "true";
}

/**
 * @param {"offline" | "db_unreachable"} demoReason - offline: API_OFFLINE_DEMO; db_unreachable: API_DEMO_ON_DB_FAILURE tras error de red
 */
export function sendDemoJson(res, body, demoReason = "offline") {
  res.setHeader("X-Gestion-API-Demo", "1");
  res.setHeader("X-Gestion-API-Demo-Reason", demoReason);
  res.json(body);
}
