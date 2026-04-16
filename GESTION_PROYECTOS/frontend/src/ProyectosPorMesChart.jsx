import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { apiUrl } from "./apiBase.js";

const API = apiUrl("/api/serie-tiempo-proyectos");

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #d1fae5",
  borderRadius: "12px",
  padding: "20px 24px 24px",
  marginTop: "16px",
  width: "100%",
  boxSizing: "border-box",
};

const COLOR_BAR_PAST = "rgba(192, 57, 43, 0.85)";
const COLOR_BAR_FUTURE = "rgba(26, 95, 168, 0.85)";
const COLOR_LINE = "#c49a2a";
const RADIUS_TOP = 4;

/**
 * @param {string} ym YYYY-MM
 */
function formatMonthAxis(ym) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(d);
}

/**
 * @param {string} ym YYYY-MM
 */
function formatMonthFullEs(ym) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1, 1);
  const s = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function enrichRows(rows) {
  let cum = 0;
  return rows.map((r) => {
    const p = Number(r.proyectos) || 0;
    cum += p;
    return {
      month: String(r.month),
      proyectos: p,
      materiales: Number(r.materiales) || 0,
      modulos: Number(r.modulos) || 0,
      past: Boolean(r.past),
      acumulado: cum,
    };
  });
}

function fmtInt(v) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(v);
}

function roundRectBarTop(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {ReturnType<typeof enrichRows>} series
 * @param {number} cssW
 * @param {number} cssH
 */
function drawChart(ctx, series, cssW, cssH, hitOut) {
  hitOut.length = 0;
  const PL = 8;
  const PR = 8;
  const PT = 18;
  const n = series.length;
  const rotateXLabels = n > 6;
  const PB = rotateXLabels ? 58 : 38;
  const innerW = Math.max(40, cssW - PL - PR);
  const innerH = Math.max(40, cssH - PT - PB);
  const baseY = PT + innerH;

  const maxBar = Math.max(...series.map((s) => s.proyectos), 1);
  const maxCum = Math.max(...series.map((s) => s.acumulado), 1);
  const yLeftMax = maxBar * 1.12;
  const yRightMax = maxCum * 1.08;
  const gap = n > 24 ? 2 : n > 14 ? 3 : 4;
  const barW = n > 0 ? Math.max(4, (innerW - gap * Math.max(0, n - 1)) / n) : 0;

  ctx.clearRect(0, 0, cssW, cssH);

  const barLabelPx = n > 18 ? 9 : n > 14 ? 9 : 10;
  series.forEach((s, i) => {
    const x = PL + i * (barW + gap);
    const hBar = (s.proyectos / yLeftMax) * innerH;
    const y = baseY - hBar;
    ctx.fillStyle = s.past ? COLOR_BAR_PAST : COLOR_BAR_FUTURE;
    roundRectBarTop(ctx, x, y, barW, hBar, RADIUS_TOP);
    ctx.fill();
    const hitH = Math.max(hBar, 10);
    const hitY = baseY - hitH;
    hitOut.push({ x, y: hitY, w: barW, h: hitH, data: s });
  });

  ctx.textAlign = "center";
  ctx.font = `${n > 18 ? 600 : 700} ${barLabelPx}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = "#1e293b";
  series.forEach((s, i) => {
    const x = PL + i * (barW + gap);
    const hBar = (s.proyectos / yLeftMax) * innerH;
    const y = baseY - hBar;
    const cx = x + barW / 2;
    const ty = Math.max(PT + 11, y - 4);
    ctx.fillText(fmtInt(s.proyectos), cx, ty);
  });

  if (series.length >= 2) {
    ctx.strokeStyle = COLOR_LINE;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    series.forEach((s, i) => {
      const cx = PL + i * (barW + gap) + barW / 2;
      const cy = baseY - (s.acumulado / yRightMax) * innerH;
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.stroke();
    series.forEach((s, i) => {
      const cx = PL + i * (barW + gap) + barW / 2;
      const cy = baseY - (s.acumulado / yRightMax) * innerH;
      ctx.fillStyle = COLOR_LINE;
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (series.length === 1) {
    const s = series[0];
    const cx = PL + barW / 2;
    const cy = baseY - (s.acumulado / yRightMax) * innerH;
    ctx.fillStyle = COLOR_LINE;
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const lineLabelPx = n > 18 ? 8 : 9;
  ctx.font = `600 ${lineLabelPx}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = COLOR_LINE;
  ctx.textAlign = "center";
  series.forEach((s, i) => {
    const cx = PL + i * (barW + gap) + barW / 2;
    const cy = baseY - (s.acumulado / yRightMax) * innerH;
    let ty = cy + 12;
    if (ty > baseY - 3) ty = cy - 10;
    if (ty < PT + 10) ty = cy + 12;
    ctx.fillText(fmtInt(s.acumulado), cx, ty);
  });

  ctx.fillStyle = "#64748b";
  const xFontPx = n > 20 ? 8 : n > 14 ? 9 : 10;
  ctx.font = `${xFontPx}px Inter, system-ui, sans-serif`;
  series.forEach((s, i) => {
    const cx = PL + i * (barW + gap) + barW / 2;
    const label = formatMonthAxis(s.month);
    if (rotateXLabels) {
      ctx.save();
      ctx.translate(cx, baseY + 10);
      ctx.rotate(-0.52);
      ctx.textAlign = "end";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 0, 0);
      ctx.restore();
    } else {
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(label, cx, baseY + 6);
    }
  });
}

/**
 * @param {{ soloVencidas?: boolean }} props
 */
export default function ProyectosPorMesChart({ soloVencidas = false }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const hitRef = useRef([]);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 300 });
  const [tooltip, setTooltip] = useState(null);

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
        const arr = Array.isArray(data) ? data : [];
        if (!cancelled) setSeries(enrichRows(arr));
      } catch {
        if (!cancelled) {
          setError(true);
          setSeries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [soloVencidas]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || series.length === 0) return;
    const { w, h } = size;
    if (w < 64) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawChart(ctx, series, w, h, hitRef.current);
  }, [series, size]);

  useLayoutEffect(() => {
    paint();
  }, [paint]);

  /** Mide cuando el canvas ya está en el DOM (el primer layout con loading=true no tenía ref). */
  useLayoutEffect(() => {
    if (loading || error || series.length === 0) return undefined;
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;

    const measure = () => {
      const rw = Math.floor(el.clientWidth || el.getBoundingClientRect().width);
      if (rw > 0) {
        setSize((prev) => (prev.w === rw && prev.h === 300 ? prev : { w: rw, h: 300 }));
      }
    };

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    measure();
    requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [loading, error, series.length]);

  const header = (
    <header className="nightingale-header">
      <h3 className="nightingale-header__title nightingale-header__title--rose">
        Proyectos por Mes de Solicitud
      </h3>
      <p className="nightingale-header__subtitle">
        Cantidad de solicitudes agrupadas por work_order_request_date
        {soloVencidas ? " · Solo fechas de pedido ya vencidas" : ""}
      </p>
    </header>
  );

  const onMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || hitRef.current.length === 0) {
      setTooltip(null);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = hitRef.current.find((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
    if (!hit) {
      setTooltip(null);
      return;
    }
    const d = hit.data;
    setTooltip({
      left: e.clientX,
      top: e.clientY,
      lines: [
        formatMonthFullEs(d.month),
        `Proyectos: ${new Intl.NumberFormat("es-CO").format(d.proyectos)}`,
        `Materiales: ${new Intl.NumberFormat("es-CO").format(d.materiales)}`,
        `Acumulado: ${new Intl.NumberFormat("es-CO").format(d.acumulado)}`,
      ],
    });
  };

  const onLeave = () => setTooltip(null);

  if (loading) {
    return (
      <div style={cardStyle} className="polar-escuelas-card nightingale-card proyectos-mes-card">
        {header}
        <p className="polar-escuelas__status">Cargando serie temporal…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={cardStyle} className="polar-escuelas-card nightingale-card proyectos-mes-card">
        {header}
        <p className="polar-escuelas__status polar-escuelas__status--error">
          No se pudieron cargar los datos de la serie
        </p>
      </div>
    );
  }

  if (series.length === 0) {
    return (
      <div style={cardStyle} className="polar-escuelas-card nightingale-card proyectos-mes-card">
        {header}
        <p className="polar-escuelas__status">Sin datos de fechas de solicitud</p>
      </div>
    );
  }

  return (
    <div style={cardStyle} className="polar-escuelas-card nightingale-card proyectos-mes-card">
      {header}
      <div className="proyectos-mes-legend" role="group" aria-label="Leyenda del gráfico">
        <div className="proyectos-mes-legend__item">
          <span
            className="proyectos-mes-legend__swatch proyectos-mes-legend__swatch--bar-past"
            aria-hidden="true"
          />
          <span className="proyectos-mes-legend__text">
            <strong>Barras (rojo):</strong> solicitudes del mes en meses ya transcurridos (antes del mes en curso).
          </span>
        </div>
        <div className="proyectos-mes-legend__item">
          <span
            className="proyectos-mes-legend__swatch proyectos-mes-legend__swatch--bar-future"
            aria-hidden="true"
          />
          <span className="proyectos-mes-legend__text">
            <strong>Barras (azul):</strong> solicitudes del mes en el mes en curso y meses futuros.
          </span>
        </div>
        <div className="proyectos-mes-legend__item">
          <span className="proyectos-mes-legend__line" aria-hidden="true" />
          <span className="proyectos-mes-legend__text">
            <strong>Línea (dorado):</strong> total acumulado de solicitudes mes a mes.
          </span>
        </div>
      </div>
      <div ref={wrapRef} className="proyectos-mes-chart-wrap">
        <canvas
          ref={canvasRef}
          className="proyectos-mes-canvas"
          onMouseMove={onMove}
          onMouseLeave={onLeave}
        />
        {tooltip && (
          <div
            className="nightingale-canvas-tooltip show proyectos-mes-tooltip"
            style={{
              position: "fixed",
              left: tooltip.left + 12,
              top: tooltip.top + 12,
              zIndex: 50,
            }}
          >
            {tooltip.lines.map((line, i) => (
              <div key={i} className={i === 0 ? "nightingale-canvas-tooltip__school" : "proyectos-mes-tooltip__line"}>
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
