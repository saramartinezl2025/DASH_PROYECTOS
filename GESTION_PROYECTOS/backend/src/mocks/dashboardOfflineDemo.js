/**
 * Carga útil alineada con las consultas reales (executiveKpis, polar, burbujas, etc.).
 * Se usa con API_OFFLINE_DEMO=true o cuando API_DEMO_ON_DB_FAILURE=true y la BD no es alcanzable.
 */

/** Una fila como `SELECT * FROM kpis` en executiveKpis.js */
export const OFFLINE_DEMO_KPIS_ROW = {
  total_proyectos: 842,
  total_modulos: 2104,
  total_granulos: 4180,
  total_materiales: 12630,
  sin_iniciar: 210,
  entregados: 295,
  abiertos: 168,
  en_revision: 169,
  pct_bloqueado: 25,
  pct_entregado: 35,
  pct_abiertos: 20,
  pct_en_revision: 20,
  materiales_bloqueados: 3150,
  pct_materiales_bloqueados: 25,
  plazo_mediano_dias: 45,
  inconsistencias_status_progreso: 12,
  inconsistencias_cerrado_no_entregado: 3,
  solicitudes_vencidas: 118,
  pct_solicitudes_vencidas: 14,
  cantidad_cerrados: 620,
  pct_cierre_general: 73.6,
};

/** Como polarSchoolProgressStacked */
export const OFFLINE_DEMO_REQUESTS_BY_SCHOOL_TYPE = [
  { school_norm: "Transformación Empresarial", progress_type: "Inicial", total: 42 },
  { school_norm: "Transformación Empresarial", progress_type: "En curso", total: 118 },
  { school_norm: "Transformación Empresarial", progress_type: "Cerrado", total: 96 },
  { school_norm: "Ingeniería", progress_type: "Inicial", total: 28 },
  { school_norm: "Ingeniería", progress_type: "En curso", total: 95 },
  { school_norm: "Ingeniería", progress_type: "Cerrado", total: 72 },
  { school_norm: "Ciencias Sociales", progress_type: "En curso", total: 64 },
  { school_norm: "Ciencias Sociales", progress_type: "Cerrado", total: 58 },
  { school_norm: "Diseño y Comunicación", progress_type: "En curso", total: 52 },
  { school_norm: "Diseño y Comunicación", progress_type: "Cerrado", total: 41 },
  { school_norm: "Salud y Bienestar", progress_type: "En curso", total: 38 },
  { school_norm: "Salud y Bienestar", progress_type: "Cerrado", total: 35 },
  { school_norm: "Externo", progress_type: "En curso", total: 22 },
  { school_norm: "Externo", progress_type: "Cerrado", total: 18 },
];

/** Como DIAS_VENCIMIENTO_HISTOGRAM filas */
export const OFFLINE_DEMO_DIAS_VENCIMIENTO = [
  { intervalo: "Más de 180 días", orden: 1, estado: "vencido", cantidad: 18 },
  { intervalo: "91 – 180 días", orden: 2, estado: "vencido", cantidad: 32 },
  { intervalo: "61 – 90 días", orden: 3, estado: "vencido", cantidad: 45 },
  { intervalo: "31 – 60 días", orden: 4, estado: "vencido", cantidad: 58 },
  { intervalo: "1 – 30 días", orden: 5, estado: "vencido", cantidad: 72 },
  { intervalo: "Hoy", orden: 6, estado: "vencido", cantidad: 12 },
  { intervalo: "Próximos 30 días", orden: 7, estado: "vigente", cantidad: 64 },
  { intervalo: "Próximos 31–90 días", orden: 8, estado: "vigente", cantidad: 41 },
  { intervalo: "Más de 90 días futuro", orden: 9, estado: "vigente", cantidad: 28 },
];

/** Como serieTiempoProyectos */
export const OFFLINE_DEMO_SERIE_TIEMPO = [
  { month: "2024-09", proyectos: 52, materiales: 780, modulos: 130, past: true },
  { month: "2024-10", proyectos: 61, materiales: 915, modulos: 152, past: true },
  { month: "2024-11", proyectos: 58, materiales: 870, modulos: 145, past: true },
  { month: "2024-12", proyectos: 67, materiales: 1005, modulos: 168, past: true },
  { month: "2025-01", proyectos: 72, materiales: 1080, modulos: 180, past: true },
  { month: "2025-02", proyectos: 64, materiales: 960, modulos: 160, past: false },
];

/** Como schoolClosureBubbles */
export const OFFLINE_DEMO_SCHOOL_BUBBLES = [
  {
    school: "Transformación Empresarial",
    total_registros: 256,
    total_cerrados: 196,
    total_materiales: 3840,
    porcentaje_cierre: 76.6,
  },
  {
    school: "Ingeniería",
    total_registros: 195,
    total_cerrados: 142,
    total_materiales: 2925,
    porcentaje_cierre: 72.8,
  },
  {
    school: "Ciencias Sociales",
    total_registros: 122,
    total_cerrados: 88,
    total_materiales: 1830,
    porcentaje_cierre: 72.1,
  },
  {
    school: "Diseño y Comunicación",
    total_registros: 93,
    total_cerrados: 64,
    total_materiales: 1395,
    porcentaje_cierre: 68.8,
  },
  {
    school: "Salud y Bienestar",
    total_registros: 73,
    total_cerrados: 48,
    total_materiales: 1095,
    porcentaje_cierre: 65.8,
  },
  {
    school: "Externo",
    total_registros: 40,
    total_cerrados: 26,
    total_materiales: 600,
    porcentaje_cierre: 65.0,
  },
];

/** Como closurePctByDeliveryMonth */
export const OFFLINE_DEMO_CIERRE_POR_MES = [
  { month: "2024-09", total_registros: 48, total_cerrados: 32, porcentaje_cierre: 66.7 },
  { month: "2024-10", total_registros: 55, total_cerrados: 40, porcentaje_cierre: 72.7 },
  { month: "2024-11", total_registros: 52, total_cerrados: 38, porcentaje_cierre: 73.1 },
  { month: "2024-12", total_registros: 60, total_cerrados: 45, porcentaje_cierre: 75.0 },
  { month: "2025-01", total_registros: 58, total_cerrados: 44, porcentaje_cierre: 75.9 },
  { month: "2025-02", total_registros: 42, total_cerrados: 30, porcentaje_cierre: 71.4 },
];
