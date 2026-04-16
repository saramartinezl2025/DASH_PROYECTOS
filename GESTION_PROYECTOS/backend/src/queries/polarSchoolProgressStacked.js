/**
 * Filas para gráfica polar apilada (ángulo: school_norm, stack: progress_type).
 * Misma normalización de escuela que executiveKpis.js (CTE school_clean).
 */
import { SCHOOL_SCOPE_ALL, SCHOOL_SCOPE_VENCIDAS } from "./vencidasScope.js";

function buildPolarSchoolProgressStacked(schoolScopeCte) {
  return `
WITH school_clean AS (
    SELECT
        progress_type,
        work_order_request_date,
        CASE
            WHEN UPPER(TRIM(COALESCE(school::text, ''))) IN (
                'ESCUELA DE TRANSFORMACI\u00d3N EMPRESARIAL',
                'ESCUELA TRANSFORMACI\u00d3N EMPRESARIAL'
            ) OR TRIM(COALESCE(school::text, '')) IN (
                'Escuela Transformaci\u00f3n Empresarial'
            )                                           THEN 'Transformaci\u00f3n Empresarial'

            WHEN UPPER(TRIM(COALESCE(school::text, ''))) IN (
                'ESCUELA DE CIENCIAS SOCIALES, JUR\u00cdDICAS Y GOBIERNO',
                'ESCUELA CIENCIAS SOCIALES, JUR\u00cdDICAS Y GOBIERNO'
            ) OR TRIM(COALESCE(school::text, '')) IN (
                'Escuela de Ciencias Sociales, Jur\u00eddicas y Gobierno',
                'Ciencias sociales, jur\u00eddicas y de gobierno',
                'Ciencias sociales, jur\u00eddicas y de Gobierno'
            )                                           THEN 'Ciencias Sociales'

            WHEN UPPER(TRIM(COALESCE(school::text, ''))) IN (
                'ESCUELA DE INGENIER\u00cdA',
                'ESCUELA DE INGENIER\u00cdAS',
                'ESCUELA DE INGENIERI\u00c1',
                'ESCUELA DE INGENIERIA'
            ) OR LOWER(TRIM(COALESCE(school::text, ''))) IN (
                'ingenieria', 'escuela de ingenieria'
            )                                           THEN 'Ingenier\u00eda'

            WHEN UPPER(TRIM(COALESCE(school::text, ''))) IN (
                'ESCUELA DE SALUD Y BIENESTAR'
            ) OR TRIM(COALESCE(school::text, '')) = 'Escuela de Salud y Bienestar'
                                                        THEN 'Salud y Bienestar'

            WHEN UPPER(TRIM(COALESCE(school::text, ''))) IN (
                'ESCUELA DE DISE\u00d1O Y COMUNICACI\u00d3N',
                'ESCUELAS DE DISE\u00d1O Y COMUNICACI\u00d3N',
                'DISE\u00d1O Y COMUNICACION'
            ) OR LOWER(TRIM(COALESCE(school::text, ''))) IN (
                'dise\u00f1o y comunicaci\u00f3n', 'dise\u00f1o',
                'dise\u00f1o y comunicaciones'
            ) OR TRIM(COALESCE(school::text, '')) = 'Dise\u00f1o y comunicaci\u00f3n'
                                                        THEN 'Dise\u00f1o y Comunicaci\u00f3n'

            WHEN UPPER(TRIM(COALESCE(school::text, ''))) = 'EXTERNO'        THEN 'Externo'
            WHEN UPPER(TRIM(COALESCE(school::text, ''))) = 'TODAS LAS ESCUELAS' THEN 'Todas las Escuelas'
            ELSE 'Sin clasificar'
        END AS school_norm

    FROM public.factory_requests
),
${schoolScopeCte},
agg AS (
    SELECT
        school_norm,
        progress_type::text AS progress_type,
        COUNT(*)::bigint AS total
    FROM school_scope
    WHERE progress_type IS NOT NULL
      AND TRIM(COALESCE(progress_type::text, '')) <> ''
    GROUP BY school_norm, progress_type::text
),
school_totals AS (
    SELECT
        school_norm,
        SUM(total) AS escuela_total
    FROM agg
    GROUP BY school_norm
)
SELECT
    a.school_norm,
    a.progress_type,
    a.total
FROM agg a
INNER JOIN school_totals t ON t.school_norm = a.school_norm
ORDER BY
    t.escuela_total DESC,
    a.school_norm,
    a.progress_type;
`;
}

export const POLAR_SCHOOL_PROGRESS_STACKED = buildPolarSchoolProgressStacked(SCHOOL_SCOPE_ALL);
export const POLAR_SCHOOL_PROGRESS_STACKED_VENCIDAS =
  buildPolarSchoolProgressStacked(SCHOOL_SCOPE_VENCIDAS);
