import { renderPorEstadoThermometer } from "./kpiStatusSegments.js";
import {
  mountDiasVencimientoChart,
  mountPolarEscuelasChart,
  mountProyectosPorMesChart,
  mountSchoolBubblesChart,
  unmountDashboardCharts,
} from "./polarEscuelasMount.jsx";

const KPI_API = "/api/dashboard/kpis";

/** Definición de tarjetas alineada con SELECT * FROM kpis */
const KPI_SECTIONS = [
  {
    title: "Totales",
    /** Una fila: 4 KPI + tasa de cierre + % vencidas (ver .dashboard-grid--6) */
    layout: "sixCols",
    cards: [
      { key: "total_proyectos", label: "Total proyectos", format: "int" },
      { key: "total_modulos", label: "Total módulos", format: "int" },
      { key: "total_granulos", label: "Total gránulos", format: "int" },
      { key: "total_materiales", label: "Total materiales", format: "int" },
      { key: "pct_cierre_general", label: "Tasa de cierre", format: "pct1" },
    ],
  },
  {
    title: "Resumen de Estado de Proyectos",
    kind: "thermometer",
  },
];

function formatValue(raw, format) {
  if (raw === null || raw === undefined) return "—";
  const n = Number(raw);
  if (Number.isNaN(n)) return String(raw);
  switch (format) {
    case "int":
      return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(n);
    case "decimal":
      return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(n);
    case "pct":
      return `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(n)} %`;
    case "pct1":
      return `${new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)}\u00a0%`;
    default:
      return String(raw);
  }
}

function formatIntEs(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Number(n));
}

/**
 * @param {Record<string, unknown>} baseline — KPI globales (primera carga); % vencidas siempre desde aquí
 * @param {boolean} expanded
 * @param {() => void} onToggle
 */
function buildVencidasFifthCard(baseline, expanded, onToggle) {
  const pct = Number(baseline.pct_solicitudes_vencidas);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className =
    "dashboard-card dashboard-card--title-value dashboard-card--vencidas-kpi" +
    (expanded ? " dashboard-card--vencidas-kpi--pressed" : "");
  btn.setAttribute("aria-expanded", expanded ? "true" : "false");
  btn.setAttribute(
    "aria-label",
    expanded
      ? "Cerrar filtro: volver a ver todas las solicitudes en las gráficas"
      : "Activar filtro: mostrar solo solicitudes vencidas en las gráficas del tablero",
  );

  const eyebrow = document.createElement("p");
  eyebrow.className = "dashboard-card__eyebrow";
  eyebrow.textContent = "Solicitudes vencidas %";

  const val = document.createElement("p");
  val.className = "dashboard-card__value";
  val.textContent = Number.isNaN(pct) ? "—" : `${formatIntEs(pct)} %`;

  btn.append(eyebrow, val);
  btn.addEventListener("click", onToggle);
  return btn;
}

function buildCard(data, def) {
  const raw = data[def.key];
  const value = formatValue(raw, def.format);

  const article = document.createElement("article");
  article.className = "dashboard-card dashboard-card--title-value";

  const eyebrow = document.createElement("p");
  eyebrow.className = "dashboard-card__eyebrow";
  eyebrow.textContent = def.label;

  const val = document.createElement("p");
  val.className = "dashboard-card__value";
  val.textContent = value;

  article.append(eyebrow, val);
  return article;
}

/**
 * @param {HTMLElement} container
 * @param {Record<string, unknown>} data
 * @param {{ baselineKpis?: Record<string, unknown> | null, vencidasVistaActiva?: boolean, onToggleVencidas?: () => void }} [ctx]
 */
function renderSections(container, data, ctx = {}) {
  const baselineKpis = ctx.baselineKpis ?? data;
  const vencidasVistaActiva = Boolean(ctx.vencidasVistaActiva);
  const onToggleVencidas = ctx.onToggleVencidas ?? (() => {});

  container.replaceChildren();
  for (const section of KPI_SECTIONS) {
    const wrap = document.createElement("section");
    wrap.className = "kpi-section";
    const headingId = `kpi-heading-${slug(section.title)}`;
    wrap.setAttribute("aria-labelledby", headingId);

    if (section.kind === "thermometer") {
      const stack = document.createElement("div");
      stack.className = "kpi-section__stack";

      const polarHost = document.createElement("div");
      polarHost.id = "polar-escuelas-root";
      polarHost.className = "diagnostico-chart-slot";
      const diasHost = document.createElement("div");
      diasHost.id = "dias-vencimiento-root";
      diasHost.className = "diagnostico-chart-slot";

      const polarDiasRow = document.createElement("div");
      polarDiasRow.className = "diagnostico-polar-dias-row";
      polarDiasRow.append(polarHost, diasHost);

      const mesHost = document.createElement("div");
      mesHost.id = "proyectos-por-mes-root";

      const bubblesHost = document.createElement("div");
      bubblesHost.id = "school-bubbles-root";

      stack.append(
        renderPorEstadoThermometer(data, {
          title: section.title,
          headingId,
          filterNote: vencidasVistaActiva
            ? "Vista filtrada: solo solicitudes con fecha de pedido anterior a hoy."
            : undefined,
        }),
        polarDiasRow,
        mesHost,
        bubblesHost,
      );
      wrap.append(stack);
      container.appendChild(wrap);
      continue;
    }

    const h2 = document.createElement("h2");
    h2.className = "kpi-section__title";
    h2.id = headingId;
    h2.textContent = section.title;

    const grid = document.createElement("div");
    grid.className = "dashboard-grid";

    if (section.layout === "sixCols") {
      wrap.classList.add("kpi-section--six-cols");
      grid.classList.add("dashboard-grid--6");
      for (const cardDef of section.cards) {
        grid.appendChild(buildCard(data, cardDef));
      }
      grid.appendChild(buildVencidasFifthCard(baselineKpis, vencidasVistaActiva, onToggleVencidas));
      wrap.append(h2, grid);
      container.appendChild(wrap);
      continue;
    }

    if (section.layout === "fourCols") {
      wrap.classList.add("kpi-section--four-cols");
      grid.classList.add("dashboard-grid--4");
    }
    for (const cardDef of section.cards) {
      grid.appendChild(buildCard(data, cardDef));
    }

    wrap.append(h2, grid);
    container.appendChild(wrap);
  }
}

function slug(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
}

export async function initDashboard() {
  const root = document.getElementById("dashboard-kpis");
  const statusEl = document.getElementById("kpi-status");
  if (!root) return;

  let baselineKpis = null;
  let vencidasVistaActiva = false;

  statusEl.textContent = "Cargando KPIs…";
  statusEl.className = "kpi-status kpi-status--loading";

  const dataSourceBadge = document.getElementById("data-source-badge");
  const dataSourceLabel = document.getElementById("data-source-badge-label");

  function setDataSourceBadge(apiDemoMode, demoReason) {
    if (!dataSourceBadge || !dataSourceLabel) return;
    dataSourceBadge.classList.toggle("data-badge--demo", apiDemoMode);
    if (!apiDemoMode) {
      dataSourceLabel.textContent = "Fuente: PostgreSQL";
      return;
    }
    dataSourceLabel.textContent =
      demoReason === "db_unreachable"
        ? "Fuente: ejemplo (PostgreSQL no alcanzable)"
        : "Fuente: datos de demostración (sin BD)";
  }

  async function applyDashboard() {
    const url = KPI_API + (vencidasVistaActiva ? "?soloVencidas=1" : "");
    const res = await fetch(url);
    const apiDemoMode = res.headers.get("X-Gestion-API-Demo") === "1";
    const demoReason = res.headers.get("X-Gestion-API-Demo-Reason") || "offline";
    if (!res.ok) {
      const errBody = await res.text();
      let detail = res.statusText;
      try {
        const j = JSON.parse(errBody);
        const parts = [];
        if (j.message) parts.push(j.message);
        if (j.detail) parts.push(j.detail);
        if (j.hint) parts.push(`Sugerencia: ${j.hint}`);
        if (j.code) parts.push(`[${j.code}]`);
        if (parts.length) detail = parts.join(" ");
        else if (j.error) detail = j.error;
      } catch {
        if (errBody && errBody.trim()) detail = errBody.trim().slice(0, 500);
        else if (res.status >= 500) {
          detail =
            "Sin cuerpo útil en la respuesta (típico: API caída o proxy de Vite apuntando a otro puerto). Abre /health en el backend (p. ej. http://127.0.0.1:3030/health) y confirma que npm run dev del backend está en marcha.";
        }
      }
      throw new Error(`${res.status} — ${detail}`);
    }
    const data = await res.json();
    if (!baselineKpis) baselineKpis = { ...data };

    unmountDashboardCharts();
    renderSections(root, data, {
      baselineKpis,
      vencidasVistaActiva,
      onToggleVencidas: () => {
        vencidasVistaActiva = !vencidasVistaActiva;
        void runDashboard();
      },
    });
    mountPolarEscuelasChart(document.getElementById("polar-escuelas-root"), vencidasVistaActiva);
    mountDiasVencimientoChart(document.getElementById("dias-vencimiento-root"));
    mountProyectosPorMesChart(
      document.getElementById("proyectos-por-mes-root"),
      vencidasVistaActiva,
    );
    mountSchoolBubblesChart(document.getElementById("school-bubbles-root"), vencidasVistaActiva);
    return { apiDemoMode, demoReason };
  }

  async function runDashboard() {
    statusEl.textContent = "Cargando KPIs…";
    statusEl.className = "kpi-status kpi-status--loading";
    try {
      const { apiDemoMode, demoReason } = await applyDashboard();
      root.setAttribute("aria-busy", "false");
      setDataSourceBadge(apiDemoMode, demoReason);
      statusEl.textContent = apiDemoMode
        ? demoReason === "db_unreachable"
          ? "Valores de ejemplo: el servidor no puede conectar a PostgreSQL desde esta red (p. ej. Cloud SQL sin IP autorizada o firewall). Con API_DEMO_ON_DB_FAILURE=true se muestran mocks hasta que la BD responda; no son datos reales."
          : "Modo demostración: API_OFFLINE_DEMO=true en el servidor (no consulta PostgreSQL)."
        : vencidasVistaActiva
          ? "Vista filtrada: solo solicitudes vencidas (fecha de pedido anterior a hoy)."
          : "Datos actualizados desde public.factory_requests (CTE school_clean).";
      statusEl.className = apiDemoMode ? "kpi-status kpi-status--demo" : "kpi-status kpi-status--ok";
    } catch (e) {
      console.error(e);
      root.innerHTML = "";
      const wrap = document.createElement("div");
      wrap.className = "kpi-error-wrap";
      const p = document.createElement("p");
      p.className = "kpi-error";
      p.innerHTML =
        "No se pudieron cargar los KPIs. Revisa el <strong>detalle técnico</strong> debajo y la línea de estado encima del panel. Suele deberse a: backend parado, proxy de Vite distinto del puerto del API (p. ej. 3030), credenciales en <code>backend/.env</code>, o error SQL (tabla/columnas).";
      const tech = document.createElement("p");
      tech.className = "kpi-error__detail";
      tech.textContent = e instanceof Error ? e.message : "Error de red";
      wrap.append(p, tech);
      root.appendChild(wrap);
      statusEl.textContent = e instanceof Error ? e.message : "Error de red";
      statusEl.className = "kpi-status kpi-status--error";
      if (dataSourceBadge) dataSourceBadge.classList.remove("data-badge--demo");
      if (dataSourceLabel) dataSourceLabel.textContent = "Fuente: no disponible";
    }
  }

  await runDashboard();
}
