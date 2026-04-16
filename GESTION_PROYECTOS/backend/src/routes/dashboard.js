import { Router } from "express";
import { isConnectivityError } from "../dbConnectivity.js";
import { getRequestsBySchoolAndType, pool } from "../db.js";
import { isDemoOnDbFailure, isOfflineDemo, sendDemoJson } from "../demoMode.js";
import { parseSoloVencidasQuery } from "../parseSoloVencidas.js";
import { EXECUTIVE_KPIS, EXECUTIVE_KPIS_SOLO_VENCIDAS } from "../queries/executiveKpis.js";
import {
  CLOSURE_PCT_BY_DELIVERY_MONTH,
  CLOSURE_PCT_BY_DELIVERY_MONTH_VENCIDAS,
} from "../queries/closurePctByDeliveryMonth.js";
import { SCHOOL_CLOSURE_BUBBLES, SCHOOL_CLOSURE_BUBBLES_VENCIDAS } from "../queries/schoolClosureBubbles.js";
import { SOLICITUDES_VENCIDAS_LIST } from "../queries/solicitudesVencidasList.js";
import {
  OFFLINE_DEMO_CIERRE_POR_MES,
  OFFLINE_DEMO_KPIS_ROW,
  OFFLINE_DEMO_REQUESTS_BY_SCHOOL_TYPE,
  OFFLINE_DEMO_SCHOOL_BUBBLES,
} from "../mocks/dashboardOfflineDemo.js";

export const dashboardRouter = Router();

function kpiDemoPayload(req) {
  return {
    ...OFFLINE_DEMO_KPIS_ROW,
    ...(parseSoloVencidasQuery(req)
      ? {
          total_proyectos: 118,
          pct_solicitudes_vencidas: 100,
          solicitudes_vencidas: 118,
        }
      : {}),
  };
}

function requestsBySchoolDemoRows(req) {
  return parseSoloVencidasQuery(req)
    ? OFFLINE_DEMO_REQUESTS_BY_SCHOOL_TYPE.filter((r) => r.progress_type !== "Inicial")
    : OFFLINE_DEMO_REQUESTS_BY_SCHOOL_TYPE;
}

function schoolBubblesDemoRows(req) {
  return parseSoloVencidasQuery(req)
    ? OFFLINE_DEMO_SCHOOL_BUBBLES.map((r) => ({
        ...r,
        total_registros: Math.max(1, Math.round(Number(r.total_registros) * 0.35)),
        total_cerrados: Math.max(1, Math.round(Number(r.total_cerrados) * 0.35)),
      }))
    : OFFLINE_DEMO_SCHOOL_BUBBLES;
}

dashboardRouter.get("/kpis", async (req, res, next) => {
  try {
    if (isOfflineDemo()) {
      sendDemoJson(res, kpiDemoPayload(req));
      return;
    }
    const sql = parseSoloVencidasQuery(req) ? EXECUTIVE_KPIS_SOLO_VENCIDAS : EXECUTIVE_KPIS;
    const { rows } = await pool.query(sql);
    if (rows.length === 0) {
      res.status(404).json({ error: "Sin datos de KPIs" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    if (isDemoOnDbFailure() && isConnectivityError(err)) {
      console.warn("[dashboard/kpis] PostgreSQL no alcanzable; demo por API_DEMO_ON_DB_FAILURE:", err.code);
      sendDemoJson(res, kpiDemoPayload(req), "db_unreachable");
      return;
    }
    next(err);
  }
});

dashboardRouter.get("/requests-by-school-type", async (req, res, next) => {
  try {
    if (isOfflineDemo()) {
      sendDemoJson(res, requestsBySchoolDemoRows(req));
      return;
    }
    const rows = await getRequestsBySchoolAndType(parseSoloVencidasQuery(req));
    res.json(rows);
  } catch (err) {
    if (isDemoOnDbFailure() && isConnectivityError(err)) {
      console.warn("[dashboard/requests-by-school-type] demo por fallo de red:", err.code);
      sendDemoJson(res, requestsBySchoolDemoRows(req), "db_unreachable");
      return;
    }
    next(err);
  }
});

dashboardRouter.get("/solicitudes-vencidas", async (_req, res, next) => {
  try {
    if (isOfflineDemo()) {
      sendDemoJson(res, []);
      return;
    }
    const { rows } = await pool.query(SOLICITUDES_VENCIDAS_LIST);
    res.json(rows);
  } catch (err) {
    if (isDemoOnDbFailure() && isConnectivityError(err)) {
      console.warn("[dashboard/solicitudes-vencidas] demo por fallo de red:", err.code);
      sendDemoJson(res, [], "db_unreachable");
      return;
    }
    next(err);
  }
});

dashboardRouter.get("/cierre-por-escuela", async (req, res, next) => {
  try {
    if (isOfflineDemo()) {
      sendDemoJson(res, schoolBubblesDemoRows(req));
      return;
    }
    const sql = parseSoloVencidasQuery(req) ? SCHOOL_CLOSURE_BUBBLES_VENCIDAS : SCHOOL_CLOSURE_BUBBLES;
    const { rows } = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    if (isDemoOnDbFailure() && isConnectivityError(err)) {
      console.warn("[dashboard/cierre-por-escuela] demo por fallo de red:", err.code);
      sendDemoJson(res, schoolBubblesDemoRows(req), "db_unreachable");
      return;
    }
    next(err);
  }
});

/** % de cierre por mes según delivery_date (solo filas con fecha de entrega). */
dashboardRouter.get("/cierre-por-mes-entrega", async (req, res, next) => {
  try {
    if (isOfflineDemo()) {
      sendDemoJson(res, OFFLINE_DEMO_CIERRE_POR_MES);
      return;
    }
    const sql = parseSoloVencidasQuery(req)
      ? CLOSURE_PCT_BY_DELIVERY_MONTH_VENCIDAS
      : CLOSURE_PCT_BY_DELIVERY_MONTH;
    const { rows } = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    if (isDemoOnDbFailure() && isConnectivityError(err)) {
      console.warn("[dashboard/cierre-por-mes-entrega] demo por fallo de red:", err.code);
      sendDemoJson(res, OFFLINE_DEMO_CIERRE_POR_MES, "db_unreachable");
      return;
    }
    next(err);
  }
});
