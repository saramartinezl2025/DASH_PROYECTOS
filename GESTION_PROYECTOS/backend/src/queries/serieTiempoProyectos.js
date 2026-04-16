/**
 * Serie mensual desde factory_requests (material_count como materiales, alineado al resto del API).
 */
const SERIE_INNER_BASE = `
  SELECT
    DATE_TRUNC('month', work_order_request_date) AS mm,
    material_count,
    module_count
  FROM public.factory_requests
  WHERE work_order_request_date IS NOT NULL
`;

const SERIE_OUTER = `
SELECT
  TO_CHAR(mm, 'YYYY-MM') AS month,
  COUNT(*)::bigint AS proyectos,
  SUM(COALESCE(material_count, 0))::bigint AS materiales,
  SUM(COALESCE(module_count, 0))::bigint AS modulos,
  (mm < DATE_TRUNC('month', CURRENT_DATE::timestamp)) AS past
FROM (
`;

const SERIE_TAIL = `
) s
GROUP BY mm
ORDER BY mm ASC
`;

export const SERIE_TIEMPO_PROYECTOS = `${SERIE_OUTER}${SERIE_INNER_BASE}${SERIE_TAIL}`;

export const SERIE_TIEMPO_PROYECTOS_VENCIDAS = `${SERIE_OUTER}${SERIE_INNER_BASE}
    AND work_order_request_date::date < CURRENT_DATE
${SERIE_TAIL}`;
