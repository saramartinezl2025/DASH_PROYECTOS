import { initDashboard } from "./dashboard.js";
import { initContentStatus } from "./contentStatus.js";

const VIEW_DIAGNOSTICO = "diagnostico";
const VIEW_ESTADO_CONTENIDO = "estado-contenido";

function normalizeHashView() {
  const hash = window.location.hash || "";
  if (hash.startsWith("#/estado-contenido")) return VIEW_ESTADO_CONTENIDO;
  return VIEW_DIAGNOSTICO;
}

function applyNavState(activeView) {
  const links = document.querySelectorAll("[data-view-link]");
  links.forEach((link) => {
    const isActive = link.getAttribute("data-view-link") === activeView;
    link.classList.toggle("top-nav__pill", isActive);
    link.classList.toggle("top-nav__link", !isActive);
    link.setAttribute("aria-current", isActive ? "page" : "false");
  });
}

function renderView(activeView) {
  const dashboardRoot = document.getElementById("dashboard-kpis");
  const dashboardStatus = document.getElementById("kpi-status");
  const contentStatusRoot = document.getElementById("estado-contenido-root");
  if (!dashboardRoot || !dashboardStatus || !contentStatusRoot) return;

  const isDiagnostico = activeView === VIEW_DIAGNOSTICO;
  dashboardRoot.hidden = !isDiagnostico;
  dashboardStatus.hidden = !isDiagnostico;
  contentStatusRoot.hidden = isDiagnostico;

  applyNavState(activeView);

  if (isDiagnostico) {
    initDashboard();
    return;
  }
  initContentStatus();
}

function handleRouteChange() {
  renderView(normalizeHashView());
}

window.addEventListener("hashchange", handleRouteChange);
handleRouteChange();
