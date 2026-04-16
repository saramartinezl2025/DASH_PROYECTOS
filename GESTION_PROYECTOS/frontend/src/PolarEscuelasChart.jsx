import React, { useEffect, useMemo, useState } from "react";
import NightingaleRoseCanvas from "./NightingaleRoseCanvas.jsx";

const API = apiUrl("/api/dashboard/requests-by-school-type");

/** Orden capas exterior -> interior (como nightingale_rose_escuelas.html). */
const ROSE_PROGRESS_ORDER = ["Inicial", "En curso", "Cerrado"];

const ROSE_PALETTE = {
  Inicial: { fill: "rgba(234,179,8,0.75)", stroke: "#ca8a04" },
  "En curso": { fill: "rgba(59,130,246,0.75)", stroke: "#2563eb" },
  Cerrado: { fill: "rgba(34,197,94,0.75)", stroke: "#16a34a" },
};

const EXTRA_STROKES = ["#9b59b6", "#e67e22", "#1abc9c", "#e74c3c", "#34495e"];

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

function hexToRgba(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(100,100,100,${alpha})`;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function shortSchoolLabel(norm) {
  const map = {
    "Transformación Empresarial": "Trans. Empresarial",
    "Ciencias Sociales": "CS Jurídicas y Gov.",
    "Salud y Bienestar": "Salud y Bienestar",
    Ingeniería: "Ingeniería",
    "Diseño y Comunicación": "Diseño y Comunic.",
    Externo: "Externo",
  };
  if (map[norm]) return map[norm];
  const s = String(norm);
  return s.length > 22 ? `${s.slice(0, 20)}…` : s;
}

function orderProgressTypes(allTypes) {
  const known = ROSE_PROGRESS_ORDER.filter((t) => allTypes.includes(t));
  const rest = [...allTypes]
    .filter((t) => !ROSE_PROGRESS_ORDER.includes(t))
    .sort((a, b) => a.localeCompare(b, "es"));
  return [...known, ...rest];
}

function buildRosePalette(orderedTypes) {
  let restIdx = 0;
  /** @type {Record<string, { fill: string, stroke: string }>} */
  const palette = {};
  orderedTypes.forEach((tipo) => {
    if (ROSE_PALETTE[tipo]) {
      palette[tipo] = ROSE_PALETTE[tipo];
    } else {
      const stroke = EXTRA_STROKES[restIdx % EXTRA_STROKES.length];
      restIdx += 1;
      palette[tipo] = { fill: hexToRgba(stroke, 0.72), stroke };
    }
  });
  return palette;
}

/**
 * @param {Array<{ school_norm?: unknown, progress_type?: unknown, total?: unknown }>} rows
 */
function buildChartModel(rows) {
  const normalized = rows
    .filter((r) => r.school_norm != null && r.progress_type != null)
    .map((r) => ({
      school_norm: String(r.school_norm),
      progress_type: String(r.progress_type),
      total: r.total,
    }));

  const allTypesRaw = [...new Set(normalized.map((r) => r.progress_type).filter(Boolean))];
  const orderedTypes = orderProgressTypes(allTypesRaw);

  const grouped = normalized.reduce((acc, { school_norm, progress_type, total }) => {
    if (!acc[school_norm]) acc[school_norm] = {};
    acc[school_norm][progress_type] = Number(total) || 0;
    return acc;
  }, {});

  Object.keys(grouped).forEach((escuela) => {
    orderedTypes.forEach((tipo) => {
      if (grouped[escuela][tipo] == null) grouped[escuela][tipo] = 0;
    });
  });

  /** Categorias que no deben aparecer como petalos del rosa. */
  const excludedSchoolNorms = new Set(["Todas las Escuelas", "Sin clasificar"]);

  const chartData = Object.entries(grouped)
    .filter(([escuela]) => !excludedSchoolNorms.has(escuela))
    .map(([escuela, tipos]) => ({
      escuela,
      name: shortSchoolLabel(escuela),
      ...tipos,
    }));

  const rowSum = (row) => orderedTypes.reduce((s, tipo) => s + (Number(row[tipo]) || 0), 0);
  chartData.sort(
    (a, b) => rowSum(b) - rowSum(a) || String(a.escuela).localeCompare(String(b.escuela), "es"),
  );

  const schools = chartData.map((row) => ({
    name: row.name,
    values: Object.fromEntries(orderedTypes.map((t) => [t, Number(row[t]) || 0])),
  }));

  const totalsByType = {};
  orderedTypes.forEach((tipo) => {
    totalsByType[tipo] = chartData.reduce((s, row) => s + (Number(row[tipo]) || 0), 0);
  });

  const palette = buildRosePalette(orderedTypes);

  return { orderedTypes, schools, totalsByType, palette };
}

function RoseLegend({ orderedTypes, totalsByType, palette }) {
  return (
    <div className="nightingale-rose-legend">
      {orderedTypes.map((tipo) => {
        const col = palette[tipo];
        return (
          <div key={tipo} className="nightingale-rose-legend__item">
            <span
              className="nightingale-rose-legend__dot"
              style={{
                background: col.fill,
                border: `1.5px solid ${col.stroke}`,
              }}
            />
            <span className="nightingale-rose-legend__label">{tipo}</span>
            <span className="nightingale-rose-legend__count">({totalsByType[tipo] ?? 0})</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * @param {{ soloVencidas?: boolean }} props
 */
export default function PolarEscuelasChart({ soloVencidas = false }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [rows, setRows] = useState([]);

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

  const { orderedTypes, schools, totalsByType, palette } = useMemo(() => buildChartModel(rows), [rows]);

  const header = (
    <header className="nightingale-header">
      <h3 className="nightingale-header__title nightingale-header__title--rose">
        Solicitudes por Escuela y Estado de Progreso
      </h3>
      <p className="nightingale-header__subtitle">
        Rosa de Nightingale · Area proporcional al volumen · Fuente: public.factory_requests
        {soloVencidas ? " · Solo solicitudes con fecha de pedido vencida" : ""}
      </p>
    </header>
  );

  if (loading) {
    return (
      <div style={cardStyle} className="polar-escuelas-card nightingale-card diagnostico-polar-pair-card">
        {header}
        <p className="polar-escuelas__status">Cargando datos…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={cardStyle} className="polar-escuelas-card nightingale-card diagnostico-polar-pair-card">
        {header}
        <p className="polar-escuelas__status polar-escuelas__status--error">
          No se pudieron cargar los datos
        </p>
      </div>
    );
  }

  if (!schools.length || !orderedTypes.length) {
    return (
      <div style={cardStyle} className="polar-escuelas-card nightingale-card diagnostico-polar-pair-card">
        {header}
        <p className="polar-escuelas__status">Sin datos disponibles</p>
      </div>
    );
  }

  return (
    <div style={cardStyle} className="polar-escuelas-card nightingale-card diagnostico-polar-pair-card">
      {header}
      <div className="nightingale-chart-wrap">
        <NightingaleRoseCanvas schools={schools} seriesOrder={orderedTypes} palette={palette} />
      </div>
      <RoseLegend orderedTypes={orderedTypes} totalsByType={totalsByType} palette={palette} />
    </div>
  );
}
