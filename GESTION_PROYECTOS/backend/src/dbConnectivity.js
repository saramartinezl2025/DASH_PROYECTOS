/** Códigos típicos cuando no hay ruta TCP a PostgreSQL (Cloud SQL, firewall, proxy). */
const CONNECTIVITY_CODES = new Set([
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EAI_AGAIN",
]);

export function isConnectivityError(err) {
  const c = err?.code;
  if (typeof c === "string" && CONNECTIVITY_CODES.has(c)) return true;
  const cause = err?.cause;
  if (cause && typeof cause.code === "string" && CONNECTIVITY_CODES.has(cause.code)) return true;
  return false;
}

export function connectivityHintEs() {
  return (
    "No se alcanza el servidor PostgreSQL (red o firewall). En Google Cloud SQL: revisa Authorized networks (tu IP pública) " +
    "o usa Cloud SQL Auth Proxy y en .env pon DB_HOST=127.0.0.1 y el puerto del proxy. " +
    "Algunas redes bloquean el 5432 saliente. Mientras tanto: API_OFFLINE_DEMO=true (solo demo) o API_DEMO_ON_DB_FAILURE=true (intenta BD y si falla la red, sirve demo)."
  );
}
