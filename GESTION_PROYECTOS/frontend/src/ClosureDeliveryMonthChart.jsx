import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "./apiBase.js";

const API = apiUrl("/api/dashboard/cierre-por-mes-entrega");

const INDIGO = "#6366F1";
const INDIGO_FILL_TOP = "rgba(99, 102, 241, 0.078)";
const INDIGO_FILL_BOTTOM = "rgba(99, 102, 241, 0)";
const BASELINE = "#e5e7eb";
const AXIS_LABEL = "#666666";
const LINE_WIDTH = 2.5;
const POINT_R = 5;
const POINT_R_HOVER = 7;
const POINT_STROKE = 2.5;
/** Divisor Catmull-Rom → Bezier: menor = curva más suave (≥ ~3.5 para “muy suave”). */
const CURVE_SMOOTH_DIV = 3.8;

function fmtPct1(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return `${new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)}\u00a0%`;
}

function fmtPctLabel(pct) {
  const n = Math.min(100, Math.max(0, Number(pct) || 0));
  const r = Math.round(n);
  if (Math.abs(n - r) < 0.05) {
    return `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(r)}%`;
  }
  return `${new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)}%`;
}

/** @param {string} ym YYYY-MM */
function formatMonthAxis(ym) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat("es-CO", { month: "short", year: "2-digit" }).format(d);
}

/**
 * Curva Catmull-Rom uniforme (suavizada) como curvas cúbicas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }[]} points
 */
function strokeSmoothCurve(ctx, points) {
  const n = points.length;
  if (n < 2) return;
  const div = CURVE_SMOOTH_DIV;
  if (n === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    return;
  }
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / div;
    const c1y = p1.y + (p2.y - p0.y) / div;
    const c2x = p2.x - (p3.x - p1.x) / div;
    const c2y = p2.y - (p3.y - p1.y) / div;
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/** @param {{ porcentaje_cierre: number }[]} pts */
function computeLabelVisibility(pts) {
  const n = pts.length;
  const show = pts.map(() => true);
  let i = 0;
  while (i < n) {
    let j = i + 1;
    const key = Math.round(pts[i].porcentaje_cierre * 10);
    while (j < n && Math.round(pts[j].porcentaje_cierre * 10) === key) j += 1;
    const run = j - i;
    if (run >= 3) {
      for (let k = i + 1; k < j - 1; k += 1) show[k] = false;
    }
    i = j;
  }
  return show;
}

function SeriesSkeleton() {
  return <div className="closure-delivery-series__skeleton" aria-hidden="true" />;
}

/**
 * Serie temporal: % de cierre por mes según delivery_date.
 * @param {{ soloVencidas?: boolean }} props
 */
export default function ClosureDeliveryMonthChart({ soloVencidas = false }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const pointsRef = useRef([]);
  const animRef = useRef(0);
  const hoverRef = useRef(-1);
  const rafRef = useRef(0);
  const paintRef = useRef(() => {});
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [size, setSize] = useState({ w: 320, h: 400 });
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

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || rows.length === 0) return;
    const { w, h } = size;
    if (w < 80 || h < 80) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const PL = 12;
    const PR = 12;
    const PT = 28;
    const n = rows.length;
    const rotateX = n > 10;
    const PB = rotateX ? 52 : 36;
    const innerW = Math.max(20, w - PL - PR);
    const innerH = Math.max(20, h - PT - PB);
    const baseX = PL;
    const baseY = PT + innerH;

    const pts = rows.map((row, i) => {
      const pct = Math.min(100, Math.max(0, Number(row.porcentaje_cierre) || 0));
      const x = n === 1 ? baseX + innerW / 2 : baseX + (i / (n - 1)) * innerW;
      const y = baseY - (pct / 100) * innerH;
      return {
        x,
        y,
        month: String(row.month ?? ""),
        total_registros: Number(row.total_registros) || 0,
        total_cerrados: Number(row.total_cerrados) || 0,
        porcentaje_cierre: pct,
      };
    });
    pointsRef.current = pts;
    const showLabel = computeLabelVisibility(pts);

    const anim = animRef.current;
    const hoverI = hoverRef.current;

    ctx.save();
    ctx.beginPath();
    ctx.rect(baseX, 0, innerW * anim + 0.5, baseY + 2);
    ctx.clip();

    if (pts.length >= 2) {
      const grad = ctx.createLinearGradient(0, PT, 0, baseY);
      grad.addColorStop(0, INDIGO_FILL_TOP);
      grad.addColorStop(1, INDIGO_FILL_BOTTOM);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      strokeSmoothCurve(ctx, pts);
      ctx.lineTo(pts[pts.length - 1].x, baseY);
      ctx.lineTo(pts[0].x, baseY);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    } else if (pts.length === 1) {
      const p = pts[0];
      const grad = ctx.createLinearGradient(0, PT, 0, baseY);
      grad.addColorStop(0, INDIGO_FILL_TOP);
      grad.addColorStop(1, INDIGO_FILL_BOTTOM);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.01, baseY);
      ctx.lineTo(p.x - 0.01, baseY);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.strokeStyle = INDIGO;
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (pts.length === 1) {
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[0].x, pts[0].y);
    } else {
      ctx.moveTo(pts[0].x, pts[0].y);
      strokeSmoothCurve(ctx, pts);
    }
    ctx.stroke();

    if (hoverI >= 0 && hoverI < pts.length) {
      const hp = pts[hoverI];
      ctx.strokeStyle = "rgba(99, 102, 241, 0.25)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hp.x, hp.y);
      ctx.lineTo(hp.x, baseY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    pts.forEach((p, i) => {
      const appear = Math.min(1, Math.max(0, anim * n - i + 0.35));
      if (appear <= 0.02) return;
      const isH = hoverI === i;
      const r = isH ? POINT_R_HOVER : POINT_R;
      ctx.save();
      ctx.globalAlpha = appear;
      if (isH) {
        ctx.shadowColor = "rgba(99, 102, 241, 0.3)";
        ctx.shadowBlur = 12;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = INDIGO;
      ctx.lineWidth = POINT_STROKE;
      ctx.stroke();
      ctx.restore();
    });

    ctx.font = '600 11px Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const padX = 6;
    const padY = 2;
    const badgeR = 4;
    const gapLabel = 8;
    pts.forEach((p, i) => {
      if (!showLabel[i]) return;
      const appear = Math.min(1, Math.max(0, anim * n - i + 0.35));
      if (appear <= 0.02) return;
      const txt = fmtPctLabel(p.porcentaje_cierre);
      const tw = ctx.measureText(txt).width;
      const bh = 11 + padY * 2;
      const bw = tw + padX * 2;
      const badgeTop = p.y - POINT_R - gapLabel - bh;
      ctx.save();
      ctx.globalAlpha = appear;
      ctx.fillStyle = "rgba(99, 102, 241, 0.051)";
      roundRectPath(ctx, p.x - bw / 2, badgeTop, bw, bh, badgeR);
      ctx.fill();
      ctx.fillStyle = INDIGO;
      ctx.fillText(txt, p.x, badgeTop + bh - padY);
      ctx.restore();
    });

    ctx.restore();

    ctx.strokeStyle = BASELINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(baseX + innerW, baseY);
    ctx.stroke();

    ctx.fillStyle = AXIS_LABEL;
    ctx.font = '400 11px Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    pts.forEach((p, i) => {
      if (rotateX && i % 2 === 1) return;
      const label = formatMonthAxis(p.month);
      if (rotateX) {
        ctx.save();
        ctx.translate(p.x, baseY + 6);
        ctx.rotate(-Math.PI / 5);
        ctx.fillText(label, 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(label, p.x, baseY + 6);
      }
    });
  }, [rows, size]);

  paintRef.current = paint;

  useLayoutEffect(() => {
    paint();
  }, [paint]);

  const seriesFingerprint = useMemo(
    () => rows.map((r) => `${r.month}:${r.porcentaje_cierre}`).join("|"),
    [rows],
  );

  useLayoutEffect(() => {
    if (loading || error || rows.length === 0) return undefined;
    cancelAnimationFrame(rafRef.current);
    animRef.current = 0;
    paintRef.current();
    let start = 0;
    const duration = 800;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const eased = 1 - (1 - p) ** 3;
      animRef.current = eased;
      paintRef.current();
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [seriesFingerprint, loading, error]);

  useLayoutEffect(() => {
    if (loading || error) return undefined;
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => {
      const rw = Math.floor(el.clientWidth || 0);
      const rh = 400;
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
  }, [loading, error, rows.length]);

  const onMove = (e) => {
    const canvas = canvasRef.current;
    const pts = pointsRef.current;
    if (!canvas || pts.length === 0) {
      setTooltip(null);
      hoverRef.current = -1;
      paintRef.current();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hitR = 16;
    let hit = -1;
    pts.forEach((p, i) => {
      const dx = mx - p.x;
      const dy = my - p.y;
      if (dx * dx + dy * dy <= hitR * hitR) hit = i;
    });
    if (hit < 0) {
      hoverRef.current = -1;
      setTooltip(null);
      paintRef.current();
      return;
    }
    hoverRef.current = hit;
    const p = pts[hit];
    setTooltip({
      left: e.clientX,
      top: e.clientY,
      month: formatMonthAxis(p.month),
      pct: fmtPct1(p.porcentaje_cierre),
    });
    paintRef.current();
  };

  const onLeave = () => {
    hoverRef.current = -1;
    setTooltip(null);
    paintRef.current();
  };

  if (loading) {
    return (
      <div className="closure-delivery-series">
        <div className="closure-delivery-series__heading">
          <h4 className="closure-delivery-series__title">% de cierre por entrega</h4>
          <p className="closure-delivery-series__sub">
            Mes de <code>delivery_date</code> · Cerrado o Entregado
            {soloVencidas ? " · Solo vencidas" : ""}
          </p>
        </div>
        <SeriesSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="closure-delivery-series">
        <div className="closure-delivery-series__heading">
          <h4 className="closure-delivery-series__title">% de cierre por entrega</h4>
        </div>
        <p className="polar-escuelas__status polar-escuelas__status--error">No se cargó la serie</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="closure-delivery-series">
        <div className="closure-delivery-series__heading">
          <h4 className="closure-delivery-series__title">% de cierre por entrega</h4>
          <p className="closure-delivery-series__sub">
            Mes de <code>delivery_date</code> · Cerrado o Entregado
          </p>
        </div>
        <p className="polar-escuelas__status">Sin registros con fecha de entrega</p>
      </div>
    );
  }

  return (
    <div className="closure-delivery-series">
      <div className="closure-delivery-series__heading">
        <h4 className="closure-delivery-series__title">% de cierre por entrega</h4>
        <p className="closure-delivery-series__sub">
          Mes de <code>delivery_date</code> · Cerrado o Entregado
          {soloVencidas ? " · Solo vencidas" : ""}
        </p>
      </div>
      <div ref={wrapRef} className="closure-delivery-series__canvas-wrap">
        <canvas
          ref={canvasRef}
          className="closure-delivery-series__canvas"
          onMouseMove={onMove}
          onMouseLeave={onLeave}
        />
        {tooltip && (
          <div
            className="closure-delivery-tooltip"
            style={{
              position: "fixed",
              left: tooltip.left + 14,
              top: tooltip.top + 14,
              zIndex: 80,
            }}
          >
            <div className="closure-delivery-tooltip__line">{tooltip.month}</div>
            <div className="closure-delivery-tooltip__line closure-delivery-tooltip__line--emph">{tooltip.pct}</div>
          </div>
        )}
      </div>
    </div>
  );
}
