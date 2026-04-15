import { apiUrl } from "./apiBase.js";
import { detailFromNestJson } from "./nestErrorDetail.js";

const CONTENT_API = apiUrl("/api/content/records");

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value);
  }
  return String(value);
}

function renderSummary(container, total, rows, columns) {
  const schools = new Set();
  const progressTypes = new Set();

  rows.forEach((row) => {
    if (row.school != null && String(row.school).trim()) schools.add(String(row.school).trim());
    if (row.progress_type != null && String(row.progress_type).trim()) {
      progressTypes.add(String(row.progress_type).trim());
    }
  });

  container.innerHTML = `
    <div class="content-status__summary-grid">
      <article class="dashboard-card dashboard-card--title-value">
        <p class="dashboard-card__eyebrow">Total registros</p>
        <p class="dashboard-card__value">${new Intl.NumberFormat("es-CO").format(total)}</p>
      </article>
      <article class="dashboard-card dashboard-card--title-value">
        <p class="dashboard-card__eyebrow">Filas cargadas en pantalla</p>
        <p class="dashboard-card__value">${new Intl.NumberFormat("es-CO").format(rows.length)}</p>
      </article>
      <article class="dashboard-card dashboard-card--title-value">
        <p class="dashboard-card__eyebrow">Escuelas detectadas</p>
        <p class="dashboard-card__value">${new Intl.NumberFormat("es-CO").format(schools.size)}</p>
      </article>
      <article class="dashboard-card dashboard-card--title-value">
        <p class="dashboard-card__eyebrow">Tipos de progreso</p>
        <p class="dashboard-card__value">${new Intl.NumberFormat("es-CO").format(progressTypes.size)}</p>
      </article>
      <article class="dashboard-card dashboard-card--title-value">
        <p class="dashboard-card__eyebrow">Columnas disponibles</p>
        <p class="dashboard-card__value">${new Intl.NumberFormat("es-CO").format(columns.length)}</p>
      </article>
    </div>
  `;
}

function renderTable(container, rows, columns) {
  if (!rows.length) {
    container.innerHTML = `<p class="content-status__body">No hay registros disponibles.</p>`;
    return;
  }

  const headerHtml = columns.map((col) => `<th>${col}</th>`).join("");
  const bodyHtml = rows
    .map((row) => {
      const tds = columns
        .map((col) => `<td title="${String(formatValue(row[col]))}">${formatValue(row[col])}</td>`)
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  container.innerHTML = `
    <div class="content-status__table-wrap">
      <table class="content-status__table">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </div>
  `;
}

export async function initContentStatus() {
  const root = document.getElementById("estado-contenido-root");
  if (!root) return;

  const status = document.getElementById("estado-contenido-status");
  const summary = document.getElementById("estado-contenido-summary");
  const table = document.getElementById("estado-contenido-table");
  if (!status || !summary || !table) return;

  status.textContent = "Cargando estado del contenido...";
  status.className = "kpi-status kpi-status--loading";
  summary.innerHTML = "";
  table.innerHTML = "";

  try {
    const res = await fetch(CONTENT_API);
    if (!res.ok) {
      const raw = await res.text();
      let detail = raw || res.statusText;
      try {
        const fromNest = detailFromNestJson(JSON.parse(raw));
        if (fromNest) detail = fromNest;
      } catch {
        /* raw no es JSON */
      }
      throw new Error(`${res.status} — ${detail}`);
    }
    const data = await res.json();
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const total = Number(data?.total ?? rows.length);
    const columns = Array.from(
      rows.reduce((set, row) => {
        Object.keys(row || {}).forEach((key) => set.add(key));
        return set;
      }, new Set()),
    );

    renderSummary(summary, total, rows, columns);
    renderTable(table, rows, columns);

    status.textContent = `Mostrando ${rows.length} de ${total} registros de public.factory_requests.`;
    status.className = "kpi-status kpi-status--ok";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Error al cargar contenido";
    status.className = "kpi-status kpi-status--error";
    table.innerHTML = `<p class="content-status__body">No se pudo cargar la información.</p>`;
  }
}
