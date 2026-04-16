import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const GAP = 0.045;

/**
 * Rosa de Nightingale en canvas (misma lógica que nightingale_rose_escuelas.html).
 * @param {{ schools: { name: string, values: Record<string, number> }[], seriesOrder: string[], palette: Record<string, { fill: string, stroke: string }> }} props
 */
export default function NightingaleRoseCanvas({ schools, seriesOrder, palette }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const hitRegionsRef = useRef([]);
  const [layoutSize, setLayoutSize] = useState(400);
  const [highlightIdx, setHighlightIdx] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const w = el.getBoundingClientRect().width;
    if (w > 0) setLayoutSize(Math.max(220, Math.min(400, Math.floor(w))));
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? el.getBoundingClientRect().width;
      setLayoutSize(Math.max(220, Math.min(400, Math.floor(w) || 400)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const drawRose = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || schools.length === 0 || seriesOrder.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const W = layoutSize * dpr;
    const H = layoutSize * dpr;
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${layoutSize}px`;
    canvas.style.height = `${layoutSize}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const CX = layoutSize / 2;
    const CY = layoutSize / 2;
    const N = schools.length;
    const sliceAngle = (Math.PI * 2) / N;

    const schoolTotals = schools.map((s) =>
      seriesOrder.reduce((a, k) => a + (s.values[k] || 0), 0),
    );
    const maxTotal = Math.max(...schoolTotals, 1);
    const R_MAX = Math.min(CX, CY) - 52;
    const R_INNER = Math.max(20, R_MAX * 0.06);
    const data = schools.map((s) => s.values);
    const PROGRESS_TYPES = ["Inicial", "En curso", "Cerrado"];

    // Radio exterior = proporcional al total de la escuela
    // SIN raíz cuadrada → radio (no área) proporcional al volumen
    function outerR(sc) {
      return R_INNER + (R_MAX - R_INNER) * (schoolTotals[sc] / maxTotal);
    }

    // Bandas internas: cada estado ocupa su % REAL dentro de la escuela
    // apiladas de adentro hacia afuera en orden: Inicial → En curso → Cerrado
    function bands(sc) {
      const total = schoolTotals[sc];
      const rOuter = outerR(sc);
      const rRange = rOuter - R_INNER;
      let cur = R_INNER;
      return PROGRESS_TYPES.map((pt) => {
        const val = data[sc][pt] || 0;
        const frac = total > 0 ? val / total : 0;
        const bw = rRange * frac;
        const band = { pt, rInner: cur, rOuter: cur + bw, val, frac };
        cur += bw;
        return band;
      });
    }

    const drawGridRings = () => {
      const rings = 4;
      for (let i = 1; i <= rings; i += 1) {
        const r = R_MAX * (i / rings);
        ctx.beginPath();
        ctx.arc(CX, CY, r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0,0,0,0.07)";
        ctx.lineWidth = 0.5;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        const val = Math.round(maxTotal * (i / rings));
        ctx.font = "9px sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "left";
        ctx.fillText(String(val), CX + 4, CY - r + 3);
      }
      for (let si = 0; si < N; si += 1) {
        const a = -Math.PI / 2 + si * sliceAngle - sliceAngle / 2;
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(CX + Math.cos(a) * (R_MAX + 8), CY + Math.sin(a) * (R_MAX + 8));
        ctx.strokeStyle = "rgba(0,0,0,0.08)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    };

    ctx.clearRect(0, 0, layoutSize, layoutSize);
    drawGridRings();
    hitRegionsRef.current = [];

    schools.forEach((school, si) => {
      const midAngle = -Math.PI / 2 + si * sliceAngle;
      const aStart = midAngle - sliceAngle / 2 + GAP / 2;
      const aEnd = midAngle + sliceAngle / 2 - GAP / 2;
      const total = schoolTotals[si];
      const alpha = highlightIdx === null || highlightIdx === si ? 1 : 0.25;

      for (const band of bands(si)) {
        if (band.rOuter - band.rInner < 0.5) continue;

        const col = palette[band.pt] || { fill: "#94a3b8", stroke: "#64748b" };

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(CX, CY, band.rOuter, aStart, aEnd, false);
        ctx.arc(CX, CY, band.rInner, aEnd, aStart, true);
        ctx.closePath();
        ctx.fillStyle = col.fill;
        ctx.fill();
        ctx.strokeStyle = col.stroke;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
      }

      hitRegionsRef.current.push({
        school: school.name,
        si,
        aStart,
        aEnd,
        r: outerR(si),
      });

      if (total > 0) {
        for (const band of bands(si)) {
          if (band.val <= 0) continue;
          if (band.rOuter - band.rInner < 16) continue;
          const midR = (band.rInner + band.rOuter) / 2;
          if (midR < 10) continue;
          const pct = Math.round((band.val / total) * 100);
          const tx = CX + Math.cos(midAngle) * midR;
          const ty = CY + Math.sin(midAngle) * midR;
          ctx.save();
          ctx.globalAlpha = highlightIdx === null || highlightIdx === si ? 1 : 0.35;
          ctx.font = "600 10px Inter, system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const text = `${pct}%`;
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.lineWidth = 3;
          ctx.lineJoin = "round";
          ctx.miterLimit = 2;
          ctx.strokeText(text, tx, ty);
          ctx.fillStyle = "rgba(15,23,42,0.92)";
          ctx.fillText(text, tx, ty);
          ctx.restore();
        }
      }

      const labelR = outerR(si) + 22;
      const lx = CX + Math.cos(midAngle) * labelR;
      const ly = CY + Math.sin(midAngle) * labelR;
      ctx.save();
      ctx.globalAlpha = highlightIdx === null || highlightIdx === si ? 1 : 0.3;
      ctx.font = "500 11px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#1e293b";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = school.name;
      const words = label.split(/\s+/);
      if (words.length > 2) {
        const mid = Math.ceil(words.length / 2);
        ctx.fillText(words.slice(0, mid).join(" "), lx, ly - 7);
        ctx.fillText(words.slice(mid).join(" "), lx, ly + 7);
      } else {
        ctx.fillText(label, lx, ly);
      }
      ctx.restore();
    });
  }, [schools, seriesOrder, palette, layoutSize, highlightIdx]);

  useEffect(() => {
    drawRose();
  }, [drawRose]);

  const hitTest = useCallback(
    (mx, my) => {
      const CX = layoutSize / 2;
      const CY = layoutSize / 2;
      const dx = mx - CX;
      const dy = my - CY;
      const r = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      for (const reg of hitRegionsRef.current) {
        let a = angle;
        const { aStart, aEnd } = reg;
        if (a < aStart - 0.01) a += Math.PI * 2;
        if (a >= aStart && a <= aEnd && r <= reg.r + 10) return reg;
      }
      return null;
    },
    [layoutSize],
  );

  const onMouseMove = (e) => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = canvas.getBoundingClientRect();
    const logicalMx = ((e.clientX - rect.left) / rect.width) * layoutSize;
    const logicalMy = ((e.clientY - rect.top) / rect.height) * layoutSize;

    const hit = hitTest(logicalMx, logicalMy);

    if (hit) {
      setHighlightIdx(hit.si);
      const school = schools[hit.si];
      const total = seriesOrder.reduce((s, k) => s + (school.values[k] || 0), 0);
      const wrapRect = wrap.getBoundingClientRect();
      const canvasOffX = rect.left - wrapRect.left;
      const canvasOffY = rect.top - wrapRect.top;
      let tx = canvasOffX + (e.clientX - rect.left) + 14;
      let ty = canvasOffY + (e.clientY - rect.top) - 10;
      if (tx + 200 > wrapRect.width) tx -= 210;
      setTooltip({
        left: tx,
        top: ty,
        schoolName: school.name,
        total,
        rows: seriesOrder.map((pt) => {
          const v = school.values[pt] || 0;
          const pct = total > 0 ? Math.round((v / total) * 100) : 0;
          return { pt, v, pct, stroke: palette[pt]?.stroke ?? "#64748b" };
        }),
      });
    } else {
      setHighlightIdx(null);
      setTooltip(null);
    }
  };

  const onMouseLeave = () => {
    setHighlightIdx(null);
    setTooltip(null);
  };

  if (schools.length === 0) return null;

  return (
    <div className="nightingale-canvas-chart-wrap">
      <div className="nightingale-canvas-inner" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="nightingale-canvas"
          width={layoutSize}
          height={layoutSize}
          aria-label="Rosa de Nightingale de solicitudes por escuela y estado de progreso"
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        />
        {tooltip && (
          <div
            className="nightingale-canvas-tooltip show"
            style={{ left: tooltip.left, top: tooltip.top }}
            role="tooltip"
          >
            <div className="nightingale-canvas-tooltip__school">{tooltip.schoolName}</div>
            <div className="nightingale-canvas-tooltip__rows">
              {tooltip.rows.map((row) => (
                <div key={row.pt} className="nightingale-canvas-tooltip__row">
                  <span
                    className="nightingale-canvas-tooltip__dot"
                    style={{ background: row.stroke }}
                  />
                  <span>{row.pt}</span>
                  <span className="nightingale-canvas-tooltip__val">
                    {row.v}{" "}
                    <span className="nightingale-canvas-tooltip__pct">{row.pct}%</span>
                  </span>
                </div>
              ))}
              <div className="nightingale-canvas-tooltip__total">
                <span className="nightingale-canvas-tooltip__total-label">Total</span>
                <span className="nightingale-canvas-tooltip__val">{tooltip.total}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
