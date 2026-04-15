import React from "react";
import { createRoot } from "react-dom/client";
import PolarEscuelasChart from "./PolarEscuelasChart.jsx";

let root;

/**
 * Monta el gráfico polar debajo del termómetro (mismo bloque de sección).
 * @param {HTMLElement | null} container
 */
export function mountPolarEscuelasChart(container) {
  if (!container) return;
  if (!root) root = createRoot(container);
  root.render(<PolarEscuelasChart />);
}
