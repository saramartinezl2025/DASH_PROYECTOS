import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { apiUrl } from "./apiBase.js";

const API = apiUrl("/api/dias-vencimiento");

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #d1fae5",
  borderRadius: "12px",
  padding: "20px 24px 24px",
  marginTop: "0",
  width: "100%",
  height: "100%",
  boxSizing: "border-box",
};

const COLOR_VENCIDO = "#c0392b";
const COLOR_VIGENTE = "#1a5fa8";
const COLOR_HOY = "#c49a2a";

/** Orden fijo eje X: más vencido → más futuro */
const INTERVAL_META = [
  { intervalo: "Más de 180 días", orden: 1, estado: "vencido" },
  { intervalo: "91 – 180 días", orden: 2, estado: "vencido" },
  { intervalo: "61 – 90 días", orden: 3, estado: "vencido" },
  { intervalo: "31 – 60 días", orden: 4, estado: "vencido" },
  { intervalo: "1 – 30 días", orden: 5, estado: "vencido" },
  { intervalo: "Hoy", orden: 6, estado: "vencido" },
  { intervalo: "Próximos 30 días", orden: 7, estado: "vigente" },
  { intervalo: "Próximos 31–90 días", orden: 8, estado: "vigente" },
  { intervalo: "Más de 90 días futuro", orden: 9, estado: "vigente" },
];

/** Índice 0-based de la última barra “pasado” (Hoy); la línea HOY va entre esta y la siguiente */
const IDX_SPLIT_AFTER = 5;

function mergeSeries(rows) {
  const byLabel = new Map(
    (Array.isArray(rows) ? rows : []).map((r) => [String(r.intervalo), r]),
  );
  return INTERVAL_META.map((m) => {
    const hit = byLabel.get(m.intervalo);
    return {
      intervalo: m.intervalo,
      orden: m.orden,
      estado: hit?.estado != null ? String(hit.estado) : m.estado,
      cantidad: hit != null ? Number(hit.cantidad) || 0 : 0,
    };
  });
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

function fmtInt(v) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(v);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {ReturnType<typeof mergeSeries>} series
 * @param {number} cssW
 * @param {number} cssH
 * @param {{ x: number, y: number, w: number, h: number, data: (typeof series)[0] }[]} hitOut
 */
function drawHistogram(ctx, series, cssW, cssH, hitOut) {
  hitOut.length = 0;
  const PL = 40;
  const PR = 16;
  const PT = 14;
  const PB = 56;
  const n = series.length;
  const innerW = Math.max(40, cssW - PL - PR);
  const innerH = Math.max(40, cssH - PT - PB);
  const baseY = PT + innerH;
  const gap = 4;
  const barW = n > 0 ? Math.max(6, (innerW - gap * Math.max(0, n - 1)) / n) : 0;
  const maxC = Math.max(...series.map((s) => s.cantidad), 1);
  const yScale = innerH / (maxC * 1.15);

  ctx.clearRect(0, 0, cssW, cssH);

  const splitX =
    PL + (IDX_SPLIT_AFTER + 1) * (barW + gap) - gap / 2;

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(30, 41, 59, 0.55)";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(splitX, PT);
  ctx.lineTo(splitX, baseY);
  ctx.stroke();
  ctx.restore();

  ctx.font = "700 10px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.textAlign = "center";
  ctx.fillText("HOY", splitX, PT - 2);

  series.forEach((s, i) => {
    const x = PL + i * (barW + gap);
    const hBar = s.cantidad * yScale;
    const y = baseY - hBar;
    let fill = COLOR_VENCIDO;
    if (s.intervalo === "Hoy") fill = COLOR_HOY;
    else if (s.estado === "vigente") fill = COLOR_VIGENTE;

    ctx.fillStyle = fill;
    if (hBar > 0) {
      roundRectBarTop(ctx, x, y, barW, hBar, 3);
      ctx.fill();
    }

    if (s.cantidad > 0) {
      ctx.font = "600 10px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#1e293b";
      ctx.textAlign = "center";
      ctx.fillText(fmtInt(s.cantidad), x + barW / 2, Math.max(PT + 10, y - 4));
    }

    hitOut.push({
      x,
      y: PT,
      w: barW,
      h: innerH + 8,
      data: s,
    });

    ctx.save();
    ctx.translate(x + barW / 2, baseY + 10);
    ctx.rotate(-0.45);
    ctx.font = "9px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#475569";
    ctx.textAlign = "end";
    ctx.textBaseline = "middle";
    const short =
      s.intervalo.length > 16 ? `${s.intervalo.slice(0, 14)}…` : s.intervalo;
    ctx.fillText(short, 0, 0);
    ctx.restore();
  });
}

function ChartSkeleton() {
  return (
    <div className="chart-card-skeleton" aria-hidden="true">
      <div className="chart-card-skeleton__bar" />
      <div className="chart-card-skeleton__bar chart-card-skeleton__bar--short" />
      <div className="chart-card-skeleton__bar" />
      <div className="chart-card-skeleton__bar chart-card-skeleton__bar--tall" />
    </div>
  );
}

export default function DiasVencimientoChart() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const hitRef = useRef([]);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 320 });
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(API);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setSeries(mergeSeries(data));
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
  }, []);

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
    drawHistogram(ctx, series, w, h, hitRef.current);
  }, [series, size]);

  useLayoutEffect(() => {
    paint();
  }, [paint]);

  useLayoutEffect(() => {
    if (loading || error || series.length === 0) return undefined;
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => {
      const rw = Math.floor(el.clientWidth || el.getBoundingClientRect().width);
      const rh = Math.floor(el.clientHeight || el.getBoundingClientRect().height);
      if (rw > 0 && rh > 0) {
        const h = Math.max(220, Math.min(520, rh));
        setSize((prev) => (prev.w === rw && prev.h === h ? prev : { w: rw, h }));
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
        Distribución de Días de Vencimiento
      </h3>
      <p className="nightingale-header__subtitle">
        Intervalos de días entre work_order_request_date y hoy
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
        d.intervalo,
        `Cantidad: ${fmtInt(d.cantidad)}`,
        d.estado === "vencido" ? "Estado: vencido" : "Estado: vigente",
      ],
    });
  };

  const onLeave = () => setTooltip(null);

  if (loading) {
    return (
      <div style={cardStyle} className="polar-escuelas-card nightingale-card diagnostico-chart-card">
        {header}
        <div className="diagnostico-dias-chart-body">
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={cardStyle} className="polar-escuelas-card nightingale-card diagnostico-chart-card">
        {header}
        <p className="polar-escuelas__status polar-escuelas__status--error">
          No se pudieron cargar los datos
        </p>
      </div>
    );
  }

  return (
    <div style={cardStyle} className="polar-escuelas-card nightingale-card diagnostico-chart-card">
      {header}
      <div ref={wrapRef} className="dias-vencimiento-chart-wrap diagnostico-dias-chart-body">
        <canvas
          ref={canvasRef}
          className="dias-vencimiento-canvas"
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
              <div
                key={i}
                className={i === 0 ? "nightingale-canvas-tooltip__school" : "proyectos-mes-tooltip__line"}
              >
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
