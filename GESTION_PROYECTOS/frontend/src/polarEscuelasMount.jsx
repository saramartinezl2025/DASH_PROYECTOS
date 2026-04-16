import React from "react";
import { createRoot } from "react-dom/client";
import DiasVencimientoChart from "./DiasVencimientoChart.jsx";
import PolarEscuelasChart from "./PolarEscuelasChart.jsx";
import ProyectosPorMesChart from "./ProyectosPorMesChart.jsx";
import SchoolBubblesChart from "./SchoolBubblesChart.jsx";

let polarRoot;
let mesRoot;
let diasVencimientoRoot;
let schoolBubblesRoot;

export function unmountDashboardCharts() {
  if (polarRoot) {
    polarRoot.unmount();
    polarRoot = null;
  }
  if (mesRoot) {
    mesRoot.unmount();
    mesRoot = null;
  }
  if (diasVencimientoRoot) {
    diasVencimientoRoot.unmount();
    diasVencimientoRoot = null;
  }
  if (schoolBubblesRoot) {
    schoolBubblesRoot.unmount();
    schoolBubblesRoot = null;
  }
}

/**
 * Monta el gráfico polar debajo del termómetro (mismo bloque de sección).
 * @param {HTMLElement | null} container
 * @param {boolean} [soloVencidas]
 */
export function mountPolarEscuelasChart(container, soloVencidas = false) {
  if (!container) return;
  if (!polarRoot) polarRoot = createRoot(container);
  polarRoot.render(<PolarEscuelasChart soloVencidas={soloVencidas} />);
}

/**
 * Serie temporal de proyectos por mes (debajo del polar).
 * @param {HTMLElement | null} container
 * @param {boolean} [soloVencidas]
 */
export function mountProyectosPorMesChart(container, soloVencidas = false) {
  if (!container) return;
  if (!mesRoot) mesRoot = createRoot(container);
  mesRoot.render(<ProyectosPorMesChart soloVencidas={soloVencidas} />);
}

/** @param {HTMLElement | null} container */
export function mountDiasVencimientoChart(container) {
  if (!container) return;
  if (!diasVencimientoRoot) diasVencimientoRoot = createRoot(container);
  diasVencimientoRoot.render(<DiasVencimientoChart />);
}

/**
 * @param {HTMLElement | null} container
 * @param {boolean} [soloVencidas]
 */
export function mountSchoolBubblesChart(container, soloVencidas = false) {
  if (!container) return;
  if (!schoolBubblesRoot) schoolBubblesRoot = createRoot(container);
  schoolBubblesRoot.render(<SchoolBubblesChart soloVencidas={soloVencidas} />);
}
