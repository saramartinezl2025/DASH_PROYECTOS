/**
 * Agregado por escuela normalizada: totales y % cierre (Cerrado o Entregado).
 * Misma CTE school_clean que executiveKpis; excluye categorías poco útiles en la visualización.
 */
import { SCHOOL_SCOPE_ALL, SCHOOL_SCOPE_VENCIDAS } from "./vencidasScope.js";

function buildSchoolClosureBubbles(schoolScopeCte) {
  return `
WITH school_clean AS (
    SELECT *,
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
                'ESCUELA DE INGENIERI\u00c1'
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
        END AS school_norm,

        CASE
            WHEN LOWER(TRIM(COALESCE(requester::text, ''))) = 'producto'    THEN 'Producto'
            WHEN COALESCE(requester::text, '') ILIKE 'SANDRA MILENA MON%'   THEN 'Sandra Monta\u00f1a'
            WHEN COALESCE(requester::text, '') ILIKE 'ANDR\u00c9S FELIPE DELGADO%' THEN 'Andr\u00e9s Delgado'
            WHEN COALESCE(requester::text, '') ILIKE 'IRON ALEXANDER%'      THEN 'Iron Fuentes'
            WHEN COALESCE(requester::text, '') ILIKE 'ANGIE ZULEYMA%'       THEN 'Angie Fontecha'
            ELSE INITCAP(NULLIF(TRIM(COALESCE(requester::text, '')), ''))
        END AS requester_norm

    FROM public.factory_requests
),
${schoolScopeCte},
agg AS (
    SELECT
        school_norm AS school,
        COUNT(*)::bigint AS total_registros,
        COUNT(*) FILTER (
            WHERE COALESCE(progress_type::text, '') = 'Cerrado'
               OR status::text = 'Entregado'
        )::bigint AS total_cerrados,
        SUM(COALESCE(material_count, 0))::bigint AS total_materiales
    FROM school_scope
    WHERE school_norm IS NOT NULL
      AND school_norm NOT IN ('Todas las Escuelas', 'Sin clasificar')
    GROUP BY school_norm
)
SELECT
    school,
    total_registros,
    total_cerrados,
    total_materiales,
    ROUND(
        total_cerrados * 100.0 / NULLIF(total_registros, 0), 1
    )::numeric AS porcentaje_cierre
FROM agg
WHERE total_registros > 0
ORDER BY total_registros DESC, school
`;
}

export const SCHOOL_CLOSURE_BUBBLES = buildSchoolClosureBubbles(SCHOOL_SCOPE_ALL);
export const SCHOOL_CLOSURE_BUBBLES_VENCIDAS = buildSchoolClosureBubbles(SCHOOL_SCOPE_VENCIDAS);
