/**
 * Misma regla que KPI solicitudes_vencidas: fecha de solicitud anterior a hoy.
 */
export const SCHOOL_SCOPE_ALL = `school_scope AS (
    SELECT * FROM school_clean
)`;

export const SCHOOL_SCOPE_VENCIDAS = `school_scope AS (
    SELECT * FROM school_clean
    WHERE work_order_request_date IS NOT NULL
      AND work_order_request_date::date < CURRENT_DATE
)`;
