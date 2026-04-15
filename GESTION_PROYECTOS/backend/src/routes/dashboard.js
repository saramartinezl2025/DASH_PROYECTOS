import { Router } from "express";
import { getRequestsBySchoolAndType, pool } from "../db.js";
import { EXECUTIVE_KPIS } from "../queries/executiveKpis.js";

export const dashboardRouter = Router();

dashboardRouter.get("/kpis", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(EXECUTIVE_KPIS);
    if (rows.length === 0) {
      res.status(404).json({ error: "Sin datos de KPIs" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/requests-by-school-type", async (_req, res, next) => {
  try {
    const rows = await getRequestsBySchoolAndType();
    res.json(rows);
  } catch (err) {
    next(err);
  }
});
