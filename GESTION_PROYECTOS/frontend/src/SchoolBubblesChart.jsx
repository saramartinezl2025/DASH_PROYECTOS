import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ClosureDeliveryMonthChart from "./ClosureDeliveryMonthChart.jsx";
import { apiUrl } from "./apiBase.js";

const API = apiUrl("/api/dashboard/cierre-por-escuela");

/** Radios base (se reescalan al ajustar al viewport). */
const R_MIN = 30;
const R_MAX = 78;

/** Misma altura útil que el canvas de «% de cierre por entrega». */
const SCHOOL_BUBBLES_CHART_HEIGHT = 400;

const ENTER_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const STAGGER_MS = 80;

/** Paleta: gradiente radial c1→c2 y sombra al 25 % del color base (RGB). */
const BUBBLE_THEME_KEYS = /** @type {const} */ ([
  "externo",
  "trans",
  "ciencias",
  "ingenieria",
  "diseno",
  "salud",
  "otros",
]);

const BUBBLE_PALETTE = {
  externo: { c1: "#6366F1", c2: "#4338CA", shadowRgb: "99, 102, 241" },
  trans: { c1: "#3B82F6", c2: "#2563EB", shadowRgb: "59, 130, 246" },
  ciencias: { c1: "#10B981", c2: "#059669", shadowRgb: "16, 185, 129" },
  ingenieria: { c1: "#F59E0B", c2: "#D97706", shadowRgb: "245, 158, 11" },
  diseno: { c1: "#EC4899", c2: "#DB2777", shadowRgb: "236, 72, 153" },
  salud: { c1: "#94A3B8", c2: "#64748B", shadowRgb: "148, 163, 184" },
  otros: { c1: "#64748B", c2: "#475569", shadowRgb: "100, 116, 139" },
};

/** @param {string} school */
function bubbleThemeForSchool(school) {
  const s = String(school).trim();
  let key = /** @type {(typeof BUBBLE_THEME_KEYS)[number]} */ ("otros");
  if (s === "Externo") key = "externo";
  else if (s === "Transformación Empresarial") key = "trans";
  else if (s === "Ciencias Sociales") key = "ciencias";
  else if (s === "Ingeniería") key = "ingenieria";
  else if (s === "Diseño y Comunicación") key = "diseno";
  else if (s === "Salud y Bienestar") key = "salud";
  return { key, ...BUBBLE_PALETTE[key] };
}

function fmtPct1(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return `${new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)}\u00a0%`;
}

function fmtPctBubble(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  const rounded = Math.abs(n - Math.round(n)) < 0.05 ? Math.round(n) : Math.round(n * 10) / 10;
  if (Number.isInteger(rounded)) {
    return `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(rounded)}\u00a0%`;
  }
  return `${new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rounded)}\u00a0%`;
}

function fmtInt(v) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Number(v) || 0);
}

/** Sin truncar: hasta 2 líneas equilibradas por palabras. */
function breakSchoolNameTwoLines(name) {
  const t = String(name).trim();
  if (!t) return ["", ""];
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [t, ""];
  if (t.length <= 18) return [t, ""];
  let bestK = 1;
  let bestScore = Infinity;
  for (let k = 1; k < words.length; k += 1) {
    const a = words.slice(0, k).join(" ");
    const b = words.slice(k).join(" ");
    const score = Math.abs(a.length - b.length);
    if (score < bestScore) {
      bestScore = score;
      bestK = k;
    }
  }
  return [words.slice(0, bestK).join(" "), words.slice(bestK).join(" ")];
}

/**
 * @param {{ x: number, y: number, r: number, school: string, total_registros: number, total_cerrados: number, porcentaje_cierre: number, total_materiales: number }[]} nodes
 */
function layoutBubbles(nodes, W, H) {
  const cx = W / 2;
  const cy = H / 2;
  const n = nodes.length;
  const spread = Math.min(W, H) * 0.22;
  const sorted = [...nodes].sort((a, b) => b.r - a.r);
  sorted.forEach((node, i) => {
    const angle = i * 2.618 + 0.35;
    const rad = spread * 0.35 + Math.sqrt(i + 1) * (spread * 0.14);
    node.x = cx + Math.cos(angle) * rad;
    node.y = cy + Math.sin(angle) * rad;
  });
  for (let it = 0; it < 100; it += 1) {
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
        const minDist = a.r + b.r + 6;
        if (d < minDist) {
          const f = ((minDist - d) / 2) * (1 / d);
          const ox = dx * f;
          const oy = dy * f;
          a.x -= ox;
          a.y -= oy;
          b.x += ox;
          b.y += oy;
        }
      }
      const ni = nodes[i];
      ni.x = Math.max(ni.r + 6, Math.min(W - ni.r - 6, ni.x));
      ni.y = Math.max(ni.r + 6, Math.min(H - ni.r - 6, ni.y));
      ni.x += (cx - ni.x) * 0.004;
      ni.y += (cy - ni.y) * 0.004;
    }
  }
}

/**
 * Escala y centra el manojo de burbujas para ocupar el viewport (sin bandas blancas).
 * Reserva margen superior para etiquetas de nombre / %.
 * @param {{ x: number, y: number, r: number }[]} nodes
 */
function fitBubblesToBounds(nodes, W, H) {
  if (nodes.length === 0) return;
  const padX = 6;
  const padBottom = 6;
  const padTop = 6;
  /** Espacio reservado sobre cada burbuja por el texto (nombre + %) */
  const labelSlack = 52;

  if (nodes.length === 1) {
    const n0 = nodes[0];
    const maxR = Math.min(W - 2 * padX, H - padTop - padBottom - labelSlack) / 2 - 2;
    n0.r = Math.min(Math.max(n0.r * 1.2, maxR * 0.92), maxR);
    n0.x = W / 2;
    n0.y = padTop + labelSlack + (H - padTop - padBottom - labelSlack) / 2;
    return;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.r);
    maxX = Math.max(maxX, n.x + n.r);
    minY = Math.min(minY, n.y - n.r - labelSlack);
    maxY = Math.max(maxY, n.y + n.r);
  }
  const bw = Math.max(maxX - minX, 1e-6);
  const bh = Math.max(maxY - minY, 1e-6);
  const availW = W - 2 * padX;
  const availH = H - padTop - padBottom;
  const scale = Math.min(availW / bw, availH / bh) * 1;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const tx = W / 2;
  const ty = padTop + availH / 2;
  for (const n of nodes) {
    n.x = (n.x - cx) * scale + tx;
    n.y = (n.y - cy) * scale + ty;
    n.r *= scale;
  }
}

function weightedClosureAverage(rows) {
  let t = 0;
  let c = 0;
  for (const r of rows) {
    t += Number(r.total_registros) || 0;
    c += Number(r.total_cerrados) || 0;
  }
  if (t === 0) return null;
  return Math.round((c / t) * 1000) / 10;
}

function ChartSkeleton() {
  return (
    <div className="school-bubbles-skeleton" aria-hidden="true">
      <div className="school-bubbles-skeleton__orb" />
      <div className="school-bubbles-skeleton__orb school-bubbles-skeleton__orb--sm" />
      <div className="school-bubbles-skeleton__orb school-bubbles-skeleton__orb--md" />
    </div>
  );
}

/**
 * @param {{
 *   rows: Record<string, unknown>[],
 *   wrapRef: React.RefObject<HTMLDivElement | null>,
 * }} props
 */
function SchoolBubblesPack({ rows, wrapRef }) {
  const [size, setSize] = useState({ w: 400, h: 400 });
  const [entered, setEntered] = useState(false);
  const [hoverSchool, setHoverSchool] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  const nodes = useMemo(() => {
    if (rows.length === 0) return [];
    return rows.map((row) => {
      const pct = Math.min(100, Math.max(0, Number(row.porcentaje_cierre) || 0));
      const r = R_MIN + (pct / 100) * (R_MAX - R_MIN);
      return {
        x: 0,
        y: 0,
        r,
        school: String(row.school ?? ""),
        total_registros: Number(row.total_registros) || 0,
        total_cerrados: Number(row.total_cerrados) || 0,
        total_materiales: Number(row.total_materiales) || 0,
        porcentaje_cierre: pct,
      };
    });
  }, [rows]);

  const laidOut = useMemo(() => {
    if (nodes.length === 0 || size.w < 64 || size.h < 64) return [];
    const copy = nodes.map((n) => ({ ...n }));
    layoutBubbles(copy, size.w, size.h);
    fitBubblesToBounds(copy, size.w, size.h);
    return copy;
  }, [nodes, size.w, size.h]);

  useEffect(() => {
    if (laidOut.length === 0) return undefined;
    setEntered(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, [laidOut.length, rows]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => {
      const rw = Math.floor(el.clientWidth || 0);
      const rh = SCHOOL_BUBBLES_CHART_HEIGHT;
      if (rw > 0) setSize((prev) => (prev.w === rw && prev.h === rh ? prev : { w: rw, h: rh }));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [rows.length, wrapRef]);

  const { w, h } = size;

  return (
    <>
      <div ref={wrapRef} className="school-bubbles-viz__stage">
        {laidOut.length > 0 && (
            <svg
              className="school-bubbles-viz__svg"
              width={w}
              height={h}
              viewBox={`0 0 ${w} ${h}`}
              role="img"
              aria-label="Burbujas de tasa de cierre por escuela"
            >
              <defs>
                {BUBBLE_THEME_KEYS.map((k) => {
                  const { c1, c2, shadowRgb } = BUBBLE_PALETTE[k];
                  return (
                    <React.Fragment key={k}>
                      <radialGradient id={`bubble-grad-${k}`} cx="32%" cy="28%" r="72%">
                        <stop offset="0%" stopColor={c1} />
                        <stop offset="100%" stopColor={c2} />
                      </radialGradient>
                      <filter
                        id={`bubble-shadow-${k}`}
                        x="-60%"
                        y="-60%"
                        width="220%"
                        height="220%"
                        colorInterpolationFilters="sRGB"
                      >
                        <feDropShadow
                          dx="0"
                          dy="8"
                          stdDeviation="14"
                          floodColor={`rgb(${shadowRgb})`}
                          floodOpacity="0.25"
                        />
                      </filter>
                    </React.Fragment>
                  );
                })}
              </defs>
              {laidOut.map((node, i) => {
                const theme = bubbleThemeForSchool(node.school);
                const [line1, line2] = breakSchoolNameTwoLines(node.school);
                const showName = node.r >= 22;
                const nameSize = node.r < 36 ? 11 : 12;
                const pctSize = node.r < 36 ? 14 : 17;
                const isActive = hoverSchool === node.school;
                const dim = Boolean(hoverSchool) && !isActive;

                return (
                  <g
                    key={node.school}
                    transform={`translate(${node.x} ${node.y})`}
                    style={{
                      opacity: dim ? 0.35 : 1,
                      transition: "opacity 0.2s ease",
                      cursor: "pointer",
                    }}
                    onMouseEnter={() => setHoverSchool(node.school)}
                    onMouseMove={(e) => {
                      setTooltip({
                        left: e.clientX,
                        top: e.clientY,
                        school: node.school,
                        cerrados: node.total_cerrados,
                        total: node.total_registros,
                        pct: node.porcentaje_cierre,
                        materiales: node.total_materiales,
                      });
                    }}
                    onMouseLeave={() => {
                      setHoverSchool(null);
                      setTooltip(null);
                    }}
                  >
                    <g
                      style={{
                        transform: entered ? "scale(1)" : "scale(0)",
                        transformBox: "fill-box",
                        transformOrigin: "50% 50%",
                        transition: `transform 0.4s ${ENTER_EASE}`,
                        transitionDelay: `${i * STAGGER_MS}ms`,
                      }}
                    >
                      <g
                        style={{
                          transform: isActive ? "scale(1.08)" : "scale(1)",
                          transition: "transform 0.2s ease",
                          transformBox: "fill-box",
                          transformOrigin: "50% 50%",
                        }}
                      >
                        <circle
                          r={node.r}
                          cx={0}
                          cy={0}
                          fill={`url(#bubble-grad-${theme.key})`}
                          stroke={theme.c2}
                          strokeWidth={2}
                          filter={`url(#bubble-shadow-${theme.key})`}
                        />
                        <text
                          textAnchor="middle"
                          fill="#FFFFFF"
                          style={{
                            fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
                            pointerEvents: "none",
                          }}
                        >
                          {showName ? (
                            <tspan x={0} dy={line2 ? -14 : -8} fontSize={nameSize} fontWeight={500}>
                              {line1}
                            </tspan>
                          ) : null}
                          {showName && line2 ? (
                            <tspan x={0} dy={13} fontSize={nameSize} fontWeight={500}>
                              {line2}
                            </tspan>
                          ) : null}
                          <tspan
                            x={0}
                            dy={showName ? (line2 ? 16 : 14) : 0}
                            fontSize={pctSize}
                            fontWeight={700}
                          >
                            {fmtPctBubble(node.porcentaje_cierre)}
                          </tspan>
                        </text>
                      </g>
                    </g>
                  </g>
                );
              })}
            </svg>
        )}
      </div>
      {tooltip && (
        <div
          className="school-bubbles-tooltip-pro school-bubbles-tooltip"
          style={{
            position: "fixed",
            left: tooltip.left + 14,
            top: tooltip.top + 14,
            zIndex: 80,
            maxWidth: "min(300px, 92vw)",
          }}
        >
          <div className="school-bubbles-tooltip-pro__title">Escuela: {tooltip.school}</div>
          <div className="school-bubbles-tooltip-pro__line">
            Proyectos cerrados: {fmtInt(tooltip.cerrados)} de {fmtInt(tooltip.total)}
          </div>
          <div className="school-bubbles-tooltip-pro__line">Tasa de cierre: {fmtPct1(tooltip.pct)}</div>
          <div className="school-bubbles-tooltip-pro__line">Materiales totales: {fmtInt(tooltip.materiales)}</div>
        </div>
      )}
    </>
  );
}

/**
 * @param {{ soloVencidas?: boolean }} props
 */
export default function SchoolBubblesChart({ soloVencidas = false }) {
  const wrapRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const q = soloVencidas ? "?soloVencidas=1" : "";
        const res = await fetch(`${API}${q}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) {
          setError(true);
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [soloVencidas]);

  const promedio = useMemo(() => weightedClosureAverage(rows), [rows]);

  const header = (
    <header className="school-bubbles-card-header">
      <div className="school-bubbles-card-header__text">
        <div className="school-bubbles-card-header__title-row">
          <h3 className="school-bubbles-card-header__title">Tasa de cierre por escuela</h3>
          {promedio != null && (
            <span className="school-bubbles-promedio-badge">Promedio: {fmtPct1(promedio)}</span>
          )}
        </div>
      </div>
    </header>
  );

  const bubblesPanel = (() => {
    if (loading) {
      return (
        <div className="school-bubbles-card__body">
          <ChartSkeleton />
        </div>
      );
    }
    if (error) {
      return (
        <div className="school-bubbles-card__body">
          <p className="polar-escuelas__status polar-escuelas__status--error">
            No se pudieron cargar las burbujas
          </p>
        </div>
      );
    }
    if (rows.length === 0) {
      return (
        <div className="school-bubbles-card__body">
          <p className="polar-escuelas__status">Sin datos por escuela</p>
        </div>
      );
    }
    return (
      <div className="school-bubbles-card__body">
        <SchoolBubblesPack rows={rows} wrapRef={wrapRef} />
      </div>
    );
  })();

  return (
    <div className="school-bubbles-charts-row">
      <div className="polar-escuelas-card nightingale-card school-bubbles-card school-bubbles-card--bubbles-only">
        {header}
        {bubblesPanel}
      </div>
      <ClosureDeliveryMonthChart soloVencidas={soloVencidas} />
    </div>
  );
}
