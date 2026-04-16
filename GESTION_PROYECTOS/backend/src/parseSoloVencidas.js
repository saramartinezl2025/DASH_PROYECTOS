/**
 * ?soloVencidas=1 | true | yes — filtra KPIs, polar y serie a solicitudes vencidas.
 */
export function parseSoloVencidasQuery(req) {
  const v = req.query?.soloVencidas;
  if (v === undefined || v === null) return false;
  const s = String(v).toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}
