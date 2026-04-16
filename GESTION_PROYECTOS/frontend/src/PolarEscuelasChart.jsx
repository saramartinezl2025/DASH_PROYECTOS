import React, { useEffect, useMemo, useState } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiUrl } from "./apiBase.js";

const API = apiUrl("/api/dashboard/requests-by-school-type");

const COLORS = [
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#ef4444",
  "#8b5cf6",
  "#f97316",
  "#06b6d4",
  "#ec4899",
];

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e8f5e9",
  borderRadius: "12px",
  padding: "20px 24px",
  marginTop: "16px",
  width: "100%",
  boxSizing: "border-box",
};

const titleStyle = {
  fontSize: "16px",
  fontWeight: 600,
  color: "#1e293b",
  marginBottom: "16px",
  marginTop: 0,
  fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
};

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

  const allTypes = [...new Set(normalized.map((r) => r.progress_type).filter(Boolean))];

  const grouped = normalized.reduce((acc, { school_norm, progress_type, total }) => {
    if (!acc[school_norm]) acc[school_norm] = {};
    acc[school_norm][progress_type] = Number(total) || 0;
    return acc;
  }, {});

  Object.keys(grouped).forEach((escuela) => {
    allTypes.forEach((tipo) => {
      if (grouped[escuela][tipo] == null) grouped[escuela][tipo] = 0;
    });
  });

  const chartData = Object.entries(grouped).map(([escuela, tipos]) => ({
    escuela,
    ...tipos,
  }));

  const rowSum = (row) =>
    allTypes.reduce((s, tipo) => s + (Number(row[tipo]) || 0), 0);
  chartData.sort(
    (a, b) => rowSum(b) - rowSum(a) || String(a.escuela).localeCompare(String(b.escuela), "es"),
  );

  return { allTypes, chartData };
}

export default function PolarEscuelasChart() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(API);
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
  }, []);

  const { allTypes, chartData } = useMemo(() => buildChartModel(rows), [rows]);

  if (loading) {
    return (
      <div style={cardStyle} className="polar-escuelas-card">
        <h3 style={titleStyle}>Distribución por Escuela y Tipo de Progreso</h3>
        <p className="polar-escuelas__status">Cargando datos…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={cardStyle} className="polar-escuelas-card">
        <h3 style={titleStyle}>Distribución por Escuela y Tipo de Progreso</h3>
        <p className="polar-escuelas__status polar-escuelas__status--error">
          No se pudieron cargar los datos
        </p>
      </div>
    );
  }

  if (!chartData.length || !allTypes.length) {
    return (
      <div style={cardStyle} className="polar-escuelas-card">
        <h3 style={titleStyle}>Distribución por Escuela y Tipo de Progreso</h3>
        <p className="polar-escuelas__status">Sin datos disponibles</p>
      </div>
    );
  }

  return (
    <div style={cardStyle} className="polar-escuelas-card">
      <h3 style={titleStyle}>Distribución por Escuela y Tipo de Progreso</h3>
      <ResponsiveContainer width="100%" height={420}>
        <RadarChart
          data={chartData}
          margin={{ top: 20, right: 40, bottom: 20, left: 40 }}
        >
          <PolarGrid gridType="polygon" stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="escuela" tick={{ fill: "#1e293b", fontSize: 12 }} />
          <PolarRadiusAxis
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            axisLine={false}
          />
          {allTypes.map((tipo, i) => (
            <Radar
              key={tipo}
              name={tipo}
              dataKey={tipo}
              stroke={COLORS[i % COLORS.length]}
              fill={COLORS[i % COLORS.length]}
              fillOpacity={0.2}
              strokeWidth={2}
            />
          ))}
          <Tooltip
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }}
            formatter={(value) => <span style={{ color: "#1e293b" }}>{value}</span>}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
