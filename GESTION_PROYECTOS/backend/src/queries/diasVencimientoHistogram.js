/**
 * Histograma: días entre work_order_request_date y hoy (intervalos pasado / futuro).
 */
export const DIAS_VENCIMIENTO_HISTOGRAM = `
WITH tagged AS (
    SELECT
        work_order_request_date::date AS fd,
        CURRENT_DATE AS hoy
    FROM public.factory_requests
    WHERE work_order_request_date IS NOT NULL
),
bucket AS (
    SELECT
        CASE
            WHEN fd <= hoy THEN 'vencido'
            ELSE 'vigente'
        END AS estado,
        CASE
            WHEN (hoy - fd) > 180 THEN 'Más de 180 días'
            WHEN (hoy - fd) > 90 THEN '91 – 180 días'
            WHEN (hoy - fd) > 60 THEN '61 – 90 días'
            WHEN (hoy - fd) > 30 THEN '31 – 60 días'
            WHEN (hoy - fd) > 0 THEN '1 – 30 días'
            WHEN hoy = fd THEN 'Hoy'
            WHEN fd > hoy AND (fd - hoy) <= 30 THEN 'Próximos 30 días'
            WHEN fd > hoy AND (fd - hoy) <= 90 THEN 'Próximos 31–90 días'
            ELSE 'Más de 90 días futuro'
        END AS intervalo,
        CASE
            WHEN (hoy - fd) > 180 THEN 1
            WHEN (hoy - fd) > 90 THEN 2
            WHEN (hoy - fd) > 60 THEN 3
            WHEN (hoy - fd) > 30 THEN 4
            WHEN (hoy - fd) > 0 THEN 5
            WHEN hoy = fd THEN 6
            WHEN fd > hoy AND (fd - hoy) <= 30 THEN 7
            WHEN fd > hoy AND (fd - hoy) <= 90 THEN 8
            ELSE 9
        END AS orden
    FROM tagged
)
SELECT
    intervalo,
    estado,
    COUNT(*)::bigint AS cantidad,
    MIN(orden)::int AS orden
FROM bucket
GROUP BY intervalo, estado
ORDER BY MIN(orden) ASC
`;
