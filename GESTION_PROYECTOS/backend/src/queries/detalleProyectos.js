/**
 * Detalle agrupado para Kanban — misma CTE school_clean que executiveKpis.js.
 * material_count se expone como "materials" en JSON para la fila de métricas.
 */
export const DETALLE_PROYECTOS = `
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
)
SELECT
    school_norm AS school,
    program,
    work_order_request_date AS date,
    progress_type,
    package_type,
    SUM(material_count) AS materials,
    SUM(module_count) AS modules,
    COUNT(*) AS solicitudes,
    (work_order_request_date::date < CURRENT_DATE) AS vencido,
    (CURRENT_DATE - work_order_request_date::date) AS dias_diff
FROM school_clean
GROUP BY school_norm, program, work_order_request_date, progress_type, package_type
ORDER BY work_order_request_date ASC
`;
