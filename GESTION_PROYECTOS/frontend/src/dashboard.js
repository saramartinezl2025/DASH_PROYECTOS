import { renderPorEstadoThermometer } from "./kpiStatusSegments.js";
import { mountPolarEscuelasChart } from "./polarEscuelasMount.jsx";
import { apiUrl } from "./apiBase.js";
import { detailFromNestJson } from "./nestErrorDetail.js";

const KPI_API = apiUrl("/api/dashboard/kpis");

/** Definición de tarjetas alineada con SELECT * FROM kpis */
const KPI_SECTIONS = [
  {
    title: "Totales",
    /** Una sola fila de 4 tarjetas (ver .dashboard-grid--4) */
    layout: "fourCols",
    cards: [
      { key: "total_proyectos", label: "Total proyectos", format: "int" },
      { key: "total_modulos", label: "Total módulos", format: "int" },
      { key: "total_granulos", label: "Total gránulos", format: "int" },
      { key: "total_materiales", label: "Total materiales", format: "int" },
    ],
  },
  {
    title: "Resumen de Estado de Proyectos",
    /** Misma fuente: pct_* del endpoint /api/dashboard/kpis (ver kpiStatusSegments.js) */
    kind: "thermometer",
  },
  {
    title: "Indicadores",
    cards: [
      { key: "materiales_bloqueados", label: "Materiales bloqueados", format: "int" },
      { key: "pct_materiales_bloqueados", label: "% Materiales bloqueados", format: "pct" },
      { key: "plazo_mediano_dias", label: "Plazo mediano (días)", format: "decimal" },
    ],
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
    default:
      return String(raw);
  }
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

function renderSections(container, data) {
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

      stack.append(
        renderPorEstadoThermometer(data, {
          title: section.title,
          headingId,
        }),
        polarHost,
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

  statusEl.textContent = "Cargando KPIs…";
  statusEl.className = "kpi-status kpi-status--loading";

  try {
    const res = await fetch(KPI_API);
    if (!res.ok) {
      const errBody = await res.text();
      let detail = res.statusText;
      try {
        const j = JSON.parse(errBody);
        const fromNest = detailFromNestJson(j);
        if (fromNest) detail = fromNest;
        else if (typeof j.error === "string") detail = j.error;
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
    renderSections(root, data);
    const polarHost = document.getElementById("polar-escuelas-root");
    mountPolarEscuelasChart(polarHost);
    root.setAttribute("aria-busy", "false");
    statusEl.textContent = "Datos actualizados desde public.factory_requests (CTE school_clean).";
    statusEl.className = "kpi-status kpi-status--ok";
  } catch (e) {
    console.error(e);
    const isNetwork =
      e instanceof TypeError &&
      typeof e.message === "string" &&
      e.message.toLowerCase().includes("failed to fetch");
    root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "kpi-error-wrap";
    const p = document.createElement("p");
    p.className = "kpi-error";
    p.innerHTML =
      "No se pudieron cargar los KPIs. Revisa el <strong>detalle técnico</strong> debajo y la línea de estado encima del panel. Suele deberse a: backend parado, proxy de Vite distinto del puerto del API (p. ej. 3030), credenciales en <code>backend/.env</code>, o error SQL (tabla/columnas).";
    const tech = document.createElement("p");
    tech.className = "kpi-error__detail";
    tech.textContent =
      e instanceof Error
        ? isNetwork
          ? `${e.message} (si en Red ves 500, suele ser CORS o mezcla de URL del API; tras redeploy del backend debería mostrarse el detalle JSON del 500).`
          : e.message
        : "Error de red";
    wrap.append(p, tech);
    root.appendChild(wrap);
    statusEl.textContent =
      e instanceof Error
        ? isNetwork
          ? `${e.message} (revisa CORS/URL del API o redeploy backend)`
          : e.message
        : "Error de red";
    statusEl.className = "kpi-status kpi-status--error";
  }
}
