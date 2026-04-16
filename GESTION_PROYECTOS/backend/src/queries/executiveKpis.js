/**
 * KPIs ejecutivos — CTE school_clean + school_scope + kpis sobre public.factory_requests.
 */
import { SCHOOL_SCOPE_ALL, SCHOOL_SCOPE_VENCIDAS } from "./vencidasScope.js";

function buildExecutiveKpis(schoolScopeCte) {
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
plazos AS (
    SELECT
        EXTRACT(EPOCH FROM (
            delivery_date::timestamptz - work_order_request_date::timestamptz
        )) / 86400 AS dias
    FROM school_scope
    WHERE delivery_date IS NOT NULL
      AND work_order_request_date IS NOT NULL
      AND EXTRACT(EPOCH FROM (
            delivery_date::timestamptz - work_order_request_date::timestamptz
          )) / 86400 BETWEEN 1 AND 730
),
kpis AS (
    SELECT
        COUNT(*)                                                AS total_proyectos,
        SUM(module_count)                                       AS total_modulos,
        SUM(granule_count)                                      AS total_granulos,
        SUM(material_count)                                     AS total_materiales,

        COUNT(*) FILTER (WHERE status::text = 'Sin iniciar')          AS sin_iniciar,
        COUNT(*) FILTER (WHERE status::text = 'Entregado')            AS entregados,
        COUNT(*) FILTER (WHERE status::text = 'Abierto')              AS abiertos,
        COUNT(*) FILTER (WHERE status::text = 'En revisi\u00f3n')          AS en_revision,

        ROUND(
            COUNT(*) FILTER (WHERE status::text = 'Sin iniciar')
            * 100.0 / NULLIF(COUNT(*), 0), 0
        )                                                       AS pct_bloqueado,

        ROUND(
            COUNT(*) FILTER (WHERE status::text = 'Entregado')
            * 100.0 / NULLIF(COUNT(*), 0), 0
        )                                                       AS pct_entregado,

        ROUND(
            COUNT(*) FILTER (WHERE status::text = 'Abierto')
            * 100.0 / NULLIF(COUNT(*), 0), 0
        )                                                       AS pct_abiertos,

        ROUND(
            COUNT(*) FILTER (WHERE status::text = 'En revisi\u00f3n')
            * 100.0 / NULLIF(COUNT(*), 0), 0
        )                                                       AS pct_en_revision,

        SUM(material_count) FILTER (WHERE status::text = 'Sin iniciar') AS materiales_bloqueados,

        ROUND(
            SUM(material_count) FILTER (WHERE status::text = 'Sin iniciar')
            * 100.0 / NULLIF(SUM(material_count), 0), 0
        )                                                       AS pct_materiales_bloqueados,

        ROUND(
            (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dias) FROM plazos)::numeric,
            0
        )                                                       AS plazo_mediano_dias,

        COUNT(*) FILTER (
            WHERE status::text = 'Sin iniciar' AND progress_type::text = 'En curso'
        )                                                       AS inconsistencias_status_progreso,

        COUNT(*) FILTER (
            WHERE progress_type::text = 'Cerrado' AND status::text != 'Entregado'
        )                                                       AS inconsistencias_cerrado_no_entregado,

        COUNT(*) FILTER (
            WHERE work_order_request_date IS NOT NULL
              AND work_order_request_date::date < CURRENT_DATE
        )                                                       AS solicitudes_vencidas,

        ROUND(
            COUNT(*) FILTER (
                WHERE work_order_request_date IS NOT NULL
                  AND work_order_request_date::date < CURRENT_DATE
            ) * 100.0 / NULLIF(COUNT(*), 0), 0
        )                                                       AS pct_solicitudes_vencidas,

        COUNT(*) FILTER (
            WHERE COALESCE(progress_type::text, '') = 'Cerrado'
               OR status::text = 'Entregado'
        )                                                       AS cantidad_cerrados,

        ROUND(
            COUNT(*) FILTER (
                WHERE COALESCE(progress_type::text, '') = 'Cerrado'
                   OR status::text = 'Entregado'
            ) * 100.0 / NULLIF(COUNT(*), 0), 1
        )                                                       AS pct_cierre_general

    FROM school_scope
)
SELECT * FROM kpis;
`;
}

export const EXECUTIVE_KPIS = buildExecutiveKpis(SCHOOL_SCOPE_ALL);
export const EXECUTIVE_KPIS_SOLO_VENCIDAS = buildExecutiveKpis(SCHOOL_SCOPE_VENCIDAS);
