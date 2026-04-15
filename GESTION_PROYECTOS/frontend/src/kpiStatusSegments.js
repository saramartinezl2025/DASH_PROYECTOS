/**
 * Distribución por estado: mismas claves que devuelve GET /api/dashboard/kpis
 * (pct_bloqueado, pct_entregado, pct_abiertos, pct_en_revision) — misma query SQL que las tarjetas.
 */

export const POR_ESTADO_SEGMENT_DEFS = [
  { apiKey: "pct_bloqueado", label: "Sin iniciar", color: "#E0B3AB", onLight: true },
  { apiKey: "pct_entregado", label: "Entregados", color: "#A9C3E6", onLight: true },
  { apiKey: "pct_abiertos", label: "Abiertos", color: "#FAE99F", onLight: true },
  { apiKey: "pct_en_revision", label: "En revisión", color: "#99CAAD", onLight: true },
];

function formatPct(raw) {
  if (raw === null || raw === undefined) return "0 %";
  const n = Number(raw);
  if (Number.isNaN(n)) return "—";
  return `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(n)} %`;
}

/**
 * @param {Record<string, unknown>} kpiRow - Una fila del JSON de /api/dashboard/kpis
 * @returns {{ label: string, color: string, apiKey: string, displayPct: string, flexGrow: number }[]}
 */
export function buildPorEstadoSegments(kpiRow) {
  const parsed = POR_ESTADO_SEGMENT_DEFS.map((def) => ({
    ...def,
    value: Math.max(0, Math.round(Number(kpiRow[def.apiKey]) || 0)),
  }));

  const sum = parsed.reduce((a, s) => a + s.value, 0);

  return parsed.map((s) => {
    const flexGrow = sum > 0 ? s.value : 0;
    return {
      apiKey: s.apiKey,
      label: s.label,
      color: s.color,
      onLight: Boolean(s.onLight),
      displayPct: formatPct(kpiRow[s.apiKey]),
      flexGrow,
    };
  });
}

/**
 * Termómetro horizontal + leyenda. Solo lectura de kpiRow; sin datos mock.
 * @param {Record<string, unknown>} kpiRow
 * @param {{ title?: string, headingId?: string }} [opts]
 * @returns {HTMLElement}
 */
export function renderPorEstadoThermometer(kpiRow, opts = {}) {
  const title = opts.title ?? "Resumen de Estado de Proyectos";
  const headingId = opts.headingId;

  const segments = buildPorEstadoSegments(kpiRow);

  const wrap = document.createElement("div");
  wrap.className = "status-thermo";

  const heading = document.createElement("h3");
  heading.className = "status-thermo__title";
  heading.textContent = title;
  if (headingId) heading.id = headingId;

  const rail = document.createElement("div");
  rail.className = "status-thermo__rail";
  rail.setAttribute("role", "img");
  rail.setAttribute(
    "aria-label",
    "Distribución por estado de proyectos según porcentajes del panel KPI",
  );

  const sumFlex = segments.reduce((a, s) => a + s.flexGrow, 0);

  for (const seg of segments) {
    const piece = document.createElement("div");
    piece.className = "status-thermo__segment";
    if (seg.onLight) piece.classList.add("status-thermo__segment--on-light");
    piece.style.backgroundColor = seg.color;
    if (sumFlex > 0) {
      piece.style.flex = `${seg.flexGrow} 1 0%`;
    } else {
      piece.style.flex = "1 1 0%";
      piece.classList.add("status-thermo__segment--empty");
    }

    piece.setAttribute("aria-label", `${seg.label}, ${seg.displayPct}`);

    const pct = document.createElement("span");
    pct.className = "status-thermo__segment-pct";
    pct.textContent = seg.displayPct;

    piece.append(pct);
    rail.appendChild(piece);
  }

  const legend = document.createElement("ul");
  legend.className = "status-thermo__legend";

  for (const seg of segments) {
    const li = document.createElement("li");
    li.className = "status-thermo__legend-item";
    li.setAttribute("aria-label", `${seg.label}, ${seg.displayPct}`);

    const sw = document.createElement("span");
    sw.className = "status-thermo__legend-swatch";
    sw.style.backgroundColor = seg.color;
    sw.setAttribute("aria-hidden", "true");

    const txt = document.createElement("span");
    txt.className = "status-thermo__legend-text";
    txt.textContent = seg.label;

    li.append(sw, txt);
    legend.appendChild(li);
  }

  wrap.append(heading, rail, legend);
  return wrap;
}
