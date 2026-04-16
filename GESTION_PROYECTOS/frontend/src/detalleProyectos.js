const DETALLE_API = "/api/detalle-proyectos";

const PROGRESS_BADGE_CLASS = {
  inicial: "detalle-table__badge-estado--inicial",
  encurso: "detalle-table__badge-estado--encurso",
  cerrado: "detalle-table__badge-estado--cerrado",
};

const PROGRESS_DOT_CLASS = {
  inicial: "detalle-table__dot--inicial",
  encurso: "detalle-table__dot--encurso",
  cerrado: "detalle-table__dot--cerrado",
};

/** @type {Record<string, unknown>[] | null} */
let detalleRowsCache = null;
let fechaSortAsc = true;

/** @type {{ programa: string; escuela: string; estado: string; vencimiento: string }} */
const filterState = {
  programa: "",
  escuela: "",
  estado: "",
  vencimiento: "",
};

function progressBucket(progressType) {
  const s = String(progressType ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (s === "cerrado") return "cerrado";
  if (s === "inicial") return "inicial";
  if (s === "en curso" || s === "encurso") return "encurso";
  return "encurso";
}

function parseRowDateMs(row) {
  const raw = row.date;
  const s = typeof raw === "string" ? raw.split("T")[0] : raw;
  const parts = String(s).split("-").map(Number);
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return 0;
  const [yy, mm, dd] = parts;
  return new Date(yy, mm - 1, dd).getTime();
}

function formatDateShortCo(dateVal) {
  const raw = typeof dateVal === "string" ? dateVal.split("T")[0] : dateVal;
  const parts = String(raw).split("-").map(Number);
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return "—";
  const [yy, mm, dd] = parts;
  const d = new Date(yy, mm - 1, dd);
  const mon = new Intl.DateTimeFormat("es-CO", { month: "short" }).format(d).replace(/\.$/, "");
  const monCap = mon.charAt(0).toUpperCase() + mon.slice(1);
  return `${dd} ${monCap} ${yy}`;
}

function formatInt(n) {
  if (n === null || n === undefined) return "—";
  const x = Number(n);
  if (Number.isNaN(x)) return "—";
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(x);
}

function relativeDaysLabel(diasDiff) {
  const n = Number(diasDiff);
  if (Number.isNaN(n)) return "";
  if (n === 0) return "Hoy";
  if (n > 0) return `Hace ${n} ${n === 1 ? "día" : "días"}`;
  const abs = Math.abs(n);
  return `En ${abs} ${abs === 1 ? "día" : "días"}`;
}

function uniqueStringsFromRows(rows, pick) {
  const s = new Set();
  for (const r of rows) {
    const v = pick(r);
    const t = v != null ? String(v).trim() : "";
    if (t) s.add(t);
  }
  return [...s].sort((a, b) => a.localeCompare(b, "es"));
}

function syncFilterStateFromDom() {
  filterState.programa = document.getElementById("detalle-filter-programa")?.value ?? "";
  filterState.escuela = document.getElementById("detalle-filter-escuela")?.value ?? "";
  filterState.estado = document.getElementById("detalle-filter-estado")?.value ?? "";
  filterState.vencimiento = document.getElementById("detalle-filter-vencimiento")?.value ?? "";
}

function rowMatchesFilters(row) {
  if (filterState.programa) {
    const p = row.program != null ? String(row.program).trim() : "";
    if (p !== filterState.programa) return false;
  }
  if (filterState.escuela) {
    const p = row.school != null ? String(row.school).trim() : "";
    if (p !== filterState.escuela) return false;
  }
  if (filterState.estado) {
    const p = row.progress_type != null ? String(row.progress_type).trim() : "";
    if (p !== filterState.estado) return false;
  }
  if (filterState.vencimiento === "vencido" && !row.vencido) return false;
  if (filterState.vencimiento === "vigente" && row.vencido) return false;
  return true;
}

function getFilteredSortedRows() {
  if (!detalleRowsCache) return [];
  const rows = detalleRowsCache.filter(rowMatchesFilters);
  rows.sort((a, b) => {
    const da = parseRowDateMs(a);
    const db = parseRowDateMs(b);
    return fechaSortAsc ? da - db : db - da;
  });
  return rows;
}

function fillSelectOptions(sel, values, allLabel) {
  if (!sel) return;
  const cur = sel.value;
  sel.replaceChildren();
  const o0 = document.createElement("option");
  o0.value = "";
  o0.textContent = allLabel;
  sel.appendChild(o0);
  for (const v of values) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    sel.appendChild(o);
  }
  const valid = cur === "" || [...sel.options].some((opt) => opt.value === cur);
  sel.value = valid ? cur : "";
}

function fillVencimientoSelect(sel) {
  if (!sel) return;
  const cur = sel.value;
  sel.replaceChildren();
  const opts = [
    ["", "Todos"],
    ["vencido", "Vencido"],
    ["vigente", "Vigente"],
  ];
  for (const [val, text] of opts) {
    const o = document.createElement("option");
    o.value = val;
    o.textContent = text;
    sel.appendChild(o);
  }
  sel.value = cur === "vencido" || cur === "vigente" ? cur : "";
}

function createFilterField(id, labelText) {
  const wrap = document.createElement("div");
  wrap.className = "detalle-filter-field";
  const label = document.createElement("label");
  label.className = "detalle-filter-field__label";
  label.htmlFor = id;
  label.textContent = labelText;
  const sel = document.createElement("select");
  sel.className = "detalle-filter-field__select";
  sel.id = id;
  wrap.append(label, sel);
  return wrap;
}

function ensureDetalleFilters() {
  const host = document.getElementById("detalle-filters");
  if (!host || !detalleRowsCache) return;

  host.hidden = false;
  let inner = host.querySelector(".detalle-filters__inner");
  if (!inner) {
    inner = document.createElement("div");
    inner.className = "detalle-filters__inner";
    inner.append(
      createFilterField("detalle-filter-programa", "Programa"),
      createFilterField("detalle-filter-escuela", "Escuela"),
      createFilterField("detalle-filter-estado", "Estado"),
      createFilterField("detalle-filter-vencimiento", "Vencimiento"),
    );
    host.appendChild(inner);
    inner.addEventListener("change", () => {
      syncFilterStateFromDom();
      const root = document.getElementById("detalle-proyectos-table");
      if (root) renderTable(root);
    });
  }

  const rows = detalleRowsCache;
  fillSelectOptions(
    document.getElementById("detalle-filter-programa"),
    uniqueStringsFromRows(rows, (r) => r.program),
    "Todos los programas",
  );
  fillSelectOptions(
    document.getElementById("detalle-filter-escuela"),
    uniqueStringsFromRows(rows, (r) => r.school),
    "Todas las escuelas",
  );
  fillSelectOptions(
    document.getElementById("detalle-filter-estado"),
    uniqueStringsFromRows(rows, (r) => r.progress_type),
    "Todos los estados",
  );
  fillVencimientoSelect(document.getElementById("detalle-filter-vencimiento"));

  syncFilterStateFromDom();
}

function wireTopNav() {
  const diagBtn = document.querySelector('[data-tab="diagnostico"]');
  const detBtn = document.querySelector('[data-tab="detalle"]');
  const paneDiag = document.getElementById("pane-diagnostico");
  const paneDet = document.getElementById("pane-detalle");
  if (!diagBtn || !detBtn || !paneDiag || !paneDet) return;

  let detalleLoaded = false;

  function setNavStyle(active) {
    const isDiag = active === "diagnostico";
    diagBtn.className = isDiag ? "top-nav__pill" : "top-nav__link top-nav__tab-btn";
    detBtn.className = isDiag ? "top-nav__link top-nav__tab-btn" : "top-nav__pill";
    if (isDiag) {
      diagBtn.setAttribute("aria-current", "page");
      detBtn.removeAttribute("aria-current");
    } else {
      detBtn.setAttribute("aria-current", "page");
      diagBtn.removeAttribute("aria-current");
    }
  }

  function showPane(id) {
    paneDiag.hidden = id !== "diagnostico";
    paneDet.hidden = id !== "detalle";
  }

  diagBtn.addEventListener("click", () => {
    setNavStyle("diagnostico");
    showPane("diagnostico");
  });

  detBtn.addEventListener("click", async () => {
    setNavStyle("detalle");
    showPane("detalle");
    if (!detalleLoaded) {
      detalleLoaded = true;
      await loadAndRenderDetalle();
    }
  });
}

function buildTableRow(row) {
  const tr = document.createElement("tr");
  tr.className = "detalle-table__row";

  const bucket = progressBucket(row.progress_type);

  const tdDot = document.createElement("td");
  tdDot.className = "detalle-table__td detalle-table__td--dot";
  const dot = document.createElement("span");
  dot.className = `detalle-table__dot ${PROGRESS_DOT_CLASS[bucket]}`;
  dot.setAttribute("aria-hidden", "true");
  tdDot.appendChild(dot);

  const tdProg = document.createElement("td");
  tdProg.className = "detalle-table__td detalle-table__td--programa";
  const prog = document.createElement("span");
  prog.className = "detalle-table__programa";
  prog.textContent =
    row.program != null && String(row.program).trim() !== "" ? String(row.program) : "—";
  tdProg.appendChild(prog);

  const tdSchool = document.createElement("td");
  tdSchool.className = "detalle-table__td detalle-table__td--escuela";
  tdSchool.textContent = row.school != null ? String(row.school) : "—";

  const tdFecha = document.createElement("td");
  tdFecha.className = "detalle-table__td detalle-table__td--fecha";
  const fechaMain = document.createElement("div");
  fechaMain.className = "detalle-table__fecha-main";
  fechaMain.textContent = formatDateShortCo(row.date);
  const fechaRel = document.createElement("div");
  fechaRel.className = "detalle-table__fecha-rel";
  fechaRel.textContent = relativeDaysLabel(row.dias_diff);
  tdFecha.append(fechaMain, fechaRel);

  const tdMat = document.createElement("td");
  tdMat.className = "detalle-table__td detalle-table__td--num";
  tdMat.textContent = formatInt(row.materials);

  const tdMod = document.createElement("td");
  tdMod.className = "detalle-table__td detalle-table__td--num";
  tdMod.textContent = formatInt(row.modules);

  const tdEstado = document.createElement("td");
  tdEstado.className = "detalle-table__td detalle-table__td--center";
  const badgeEst = document.createElement("span");
  badgeEst.className = `detalle-table__badge-estado ${PROGRESS_BADGE_CLASS[bucket]}`;
  badgeEst.textContent = row.progress_type != null ? String(row.progress_type) : "—";
  tdEstado.appendChild(badgeEst);

  const tdVenc = document.createElement("td");
  tdVenc.className = "detalle-table__td detalle-table__td--center";
  const vencido = Boolean(row.vencido);
  if (vencido) {
    const pill = document.createElement("span");
    pill.className = "detalle-table__badge-venc detalle-table__badge-venc--vencido";
    pill.textContent = "Vencido";
    tdVenc.appendChild(pill);
  } else {
    const dash = document.createElement("span");
    dash.className = "detalle-table__venc-empty";
    dash.textContent = "—";
    tdVenc.appendChild(dash);
  }

  tr.append(tdDot, tdProg, tdSchool, tdFecha, tdMat, tdMod, tdEstado, tdVenc);
  return tr;
}

function renderTable(root) {
  syncFilterStateFromDom();
  root.replaceChildren();
  const rows = getFilteredSortedRows();

  const wrap = document.createElement("div");
  wrap.className = "detalle-table-scroll";

  const table = document.createElement("table");
  table.className = "detalle-table";
  table.setAttribute("aria-label", "Detalle de proyectos");

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");

  const thDot = document.createElement("th");
  thDot.className = "detalle-table__th detalle-table__th--dot";
  thDot.setAttribute("aria-hidden", "true");

  const thProg = document.createElement("th");
  thProg.className = "detalle-table__th detalle-table__th--programa";
  thProg.textContent = "Programa";

  const thEsc = document.createElement("th");
  thEsc.className = "detalle-table__th detalle-table__th--escuela";
  thEsc.textContent = "Escuela";

  const thFecha = document.createElement("th");
  thFecha.className = "detalle-table__th detalle-table__th--fecha";
  const btnFecha = document.createElement("button");
  btnFecha.type = "button";
  btnFecha.className = "detalle-table__sort-btn";
  btnFecha.setAttribute("aria-sort", fechaSortAsc ? "ascending" : "descending");
  btnFecha.innerHTML = `Fecha <span class="detalle-table__sort-icon" aria-hidden="true">${fechaSortAsc ? "↑" : "↓"}</span>`;
  btnFecha.title = "Ordenar por fecha";
  btnFecha.addEventListener("click", () => {
    fechaSortAsc = !fechaSortAsc;
    syncFilterStateFromDom();
    renderTable(root);
  });
  thFecha.appendChild(btnFecha);

  const thMat = document.createElement("th");
  thMat.className = "detalle-table__th detalle-table__th--num";
  thMat.textContent = "Materiales";

  const thMod = document.createElement("th");
  thMod.className = "detalle-table__th detalle-table__th--num";
  thMod.textContent = "Módulos";

  const thEst = document.createElement("th");
  thEst.className = "detalle-table__th detalle-table__th--center";
  thEst.textContent = "Estado";

  const thVenc = document.createElement("th");
  thVenc.className = "detalle-table__th detalle-table__th--center";
  thVenc.textContent = "Vencimiento";

  hr.append(thDot, thProg, thEsc, thFecha, thMat, thMod, thEst, thVenc);
  thead.appendChild(hr);

  const tbody = document.createElement("tbody");
  for (const row of rows) {
    tbody.appendChild(buildTableRow(row));
  }

  table.append(thead, tbody);
  wrap.appendChild(table);
  root.appendChild(wrap);
}

async function loadAndRenderDetalle() {
  const statusEl = document.getElementById("detalle-status");
  const root = document.getElementById("detalle-proyectos-table");
  if (!root) return;

  if (statusEl) {
    statusEl.textContent = "Cargando detalle de proyectos…";
    statusEl.className = "kpi-status kpi-status--loading";
  }
  const filtHost = document.getElementById("detalle-filters");
  if (filtHost) filtHost.hidden = true;

  try {
    const res = await fetch(DETALLE_API);
    if (!res.ok) {
      const errBody = await res.text();
      let detail = res.statusText;
      try {
        const j = JSON.parse(errBody);
        const parts = [];
        if (j.message) parts.push(j.message);
        if (j.detail) parts.push(j.detail);
        if (j.code) parts.push(`[${j.code}]`);
        if (parts.length) detail = parts.join(" ");
        else if (j.error) detail = j.error;
      } catch {
        if (errBody && errBody.trim()) detail = errBody.trim().slice(0, 500);
      }
      throw new Error(`${res.status} — ${detail}`);
    }
    const rows = await res.json();
    detalleRowsCache = Array.isArray(rows) ? rows : [];
    fechaSortAsc = true;
    filterState.programa = "";
    filterState.escuela = "";
    filterState.estado = "";
    filterState.vencimiento = "";
    for (const id of [
      "detalle-filter-programa",
      "detalle-filter-escuela",
      "detalle-filter-estado",
      "detalle-filter-vencimiento",
    ]) {
      const el = document.getElementById(id);
      if (el) el.value = "";
    }
    if (statusEl) {
      statusEl.textContent = "Tabla desde public.factory_requests (CTE school_clean).";
      statusEl.className = "kpi-status kpi-status--ok";
    }
    ensureDetalleFilters();
    renderTable(root);
  } catch (e) {
    console.error(e);
    detalleRowsCache = null;
    if (filtHost) {
      filtHost.hidden = true;
      filtHost.replaceChildren();
    }
    root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "kpi-error-wrap";
    const p = document.createElement("p");
    p.className = "kpi-error";
    p.innerHTML =
      "No se pudieron cargar los proyectos. Revisa el <strong>detalle técnico</strong>, el backend y <code>backend/.env</code>.";
    const tech = document.createElement("p");
    tech.className = "kpi-error__detail";
    tech.textContent = e instanceof Error ? e.message : "Error de red";
    wrap.append(p, tech);
    root.appendChild(wrap);
    if (statusEl) {
      statusEl.textContent = e instanceof Error ? e.message : "Error de red";
      statusEl.className = "kpi-status kpi-status--error";
    }
  }
}

export function initDetalleProyectosShell() {
  wireTopNav();
}
