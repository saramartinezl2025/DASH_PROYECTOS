/**
 * Extrae un mensaje legible del JSON de error de Nest (HttpException, 500, validación).
 */
export function detailFromNestJson(j) {
  if (!j || typeof j !== "object") return "";
  const out = [];
  const push = (s) => {
    if (typeof s !== "string" || !s.trim()) return;
    out.push(s.trim());
  };

  push(j.detail);
  push(j.error);
  if (typeof j.hint === "string") push(`Sugerencia: ${j.hint}`);
  if (j.code != null) push(`[${String(j.code)}]`);

  const msg = j.message;
  if (typeof msg === "string") push(msg);
  else if (msg && typeof msg === "object" && !Array.isArray(msg)) {
    push(msg.detail);
    push(msg.error);
    if (typeof msg.hint === "string") push(`Sugerencia: ${msg.hint}`);
  } else if (Array.isArray(msg)) {
    for (const item of msg) {
      if (typeof item === "string") push(item);
      else if (item && typeof item === "object") {
        push(typeof item.detail === "string" ? item.detail : item.message);
      }
    }
  }

  return [...new Set(out)].join(" ").trim();
}
