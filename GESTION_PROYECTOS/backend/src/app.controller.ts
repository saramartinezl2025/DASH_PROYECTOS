import {
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const EXECUTIVE_KPIS_SQL = `
WITH plazos AS (
  SELECT
    EXTRACT(EPOCH FROM (
      delivery_date::timestamptz - work_order_request_date::timestamptz
    )) / 86400 AS dias
  FROM public.factory_requests
  WHERE delivery_date IS NOT NULL
    AND work_order_request_date IS NOT NULL
    AND EXTRACT(EPOCH FROM (
      delivery_date::timestamptz - work_order_request_date::timestamptz
    )) / 86400 BETWEEN 1 AND 730
),
kpis AS (
  SELECT
    COUNT(*)::bigint AS total_proyectos,
    COALESCE(SUM(module_count), 0)::bigint AS total_modulos,
    COALESCE(SUM(granule_count), 0)::bigint AS total_granulos,
    COALESCE(SUM(material_count), 0)::bigint AS total_materiales,

    COALESCE(SUM(material_count) FILTER (WHERE status::text = 'Sin iniciar'), 0)::bigint AS materiales_bloqueados,

    COALESCE(
      ROUND(
        COALESCE(SUM(material_count) FILTER (WHERE status::text = 'Sin iniciar'), 0)
        * 100.0 / NULLIF(COALESCE(SUM(material_count), 0), 0),
        0
      ),
      0
    )::int AS pct_materiales_bloqueados,

    COALESCE(
      ROUND(
        COUNT(*) FILTER (WHERE status::text = 'Sin iniciar') * 100.0 / NULLIF(COUNT(*), 0),
        0
      ),
      0
    )::int AS pct_bloqueado,
    COALESCE(
      ROUND(
        COUNT(*) FILTER (WHERE status::text = 'Entregado') * 100.0 / NULLIF(COUNT(*), 0),
        0
      ),
      0
    )::int AS pct_entregado,
    COALESCE(
      ROUND(
        COUNT(*) FILTER (WHERE status::text = 'Abierto') * 100.0 / NULLIF(COUNT(*), 0),
        0
      ),
      0
    )::int AS pct_abiertos,
    COALESCE(
      ROUND(
        COUNT(*) FILTER (WHERE status::text ILIKE 'En revis%')
        * 100.0 / NULLIF(COUNT(*), 0),
        0
      ),
      0
    )::int AS pct_en_revision,

    COALESCE(
      ROUND(
        (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dias) FROM plazos)::numeric,
        0
      ),
      0
    )::int AS plazo_mediano_dias
  FROM public.factory_requests
)
SELECT * FROM kpis;
`;

const REQUESTS_BY_SCHOOL_TYPE_SQL = `
SELECT
  COALESCE(NULLIF(TRIM(school::text), ''), 'Sin clasificar') AS school_norm,
  COALESCE(NULLIF(TRIM(progress_type::text), ''), 'Sin clasificar') AS progress_type,
  COUNT(*)::bigint AS total
FROM public.factory_requests
GROUP BY
  COALESCE(NULLIF(TRIM(school::text), ''), 'Sin clasificar'),
  COALESCE(NULLIF(TRIM(progress_type::text), ''), 'Sin clasificar')
ORDER BY total DESC, school_norm, progress_type;
`;

const CONTENT_RECORDS_SQL = `
SELECT to_jsonb(fr) AS row
FROM public.factory_requests fr
ORDER BY fr.work_order_request_date DESC NULLS LAST
LIMIT 500;
`;

@Controller()
export class AppController implements OnModuleDestroy {
  private readonly logger = new Logger(AppController.name);
  /** Evita crear el motor de Prisma durante NestFactory.create (Cloud Run exige abrir PORT pronto). */
  private prisma: PrismaClient | null = null;

  private db(): PrismaClient {
    if (!this.prisma) {
      this.prisma = new PrismaClient();
    }
    return this.prisma;
  }

  @Get()
  getRoot(): { message: string } {
    return { message: 'gestion-proyectos-backend up' };
  }

  @Get('health')
  getHealth(): { status: string } {
    return { status: 'ok' };
  }

  /** Comprueba conexión a PostgreSQL (útil en Cloud Run / Cloud SQL). */
  @Get('health/db')
  async getHealthDb(): Promise<{ ok: boolean; detail?: string }> {
    try {
      await this.db().$queryRawUnsafe('SELECT 1 AS ok');
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`health/db: ${message}`);
      return { ok: false, detail: message };
    }
  }

  @Get('api/dashboard/kpis')
  async getDashboardKpis(): Promise<Record<string, number>> {
    try {
      const rows = await this.db().$queryRawUnsafe<Array<Record<string, unknown>>>(
        EXECUTIVE_KPIS_SQL,
      );
      const row = rows?.[0] ?? {};

      return {
        total_proyectos: Number(row.total_proyectos ?? 0),
        total_modulos: Number(row.total_modulos ?? 0),
        total_granulos: Number(row.total_granulos ?? 0),
        total_materiales: Number(row.total_materiales ?? 0),
        materiales_bloqueados: Number(row.materiales_bloqueados ?? 0),
        pct_materiales_bloqueados: Number(row.pct_materiales_bloqueados ?? 0),
        plazo_mediano_dias: Number(row.plazo_mediano_dias ?? 0),
        pct_bloqueado: Number(row.pct_bloqueado ?? 0),
        pct_entregado: Number(row.pct_entregado ?? 0),
        pct_abiertos: Number(row.pct_abiertos ?? 0),
        pct_en_revision: Number(row.pct_en_revision ?? 0),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error SQL no identificado';
      this.logger.error(`getDashboardKpis: ${message}`);
      throw new InternalServerErrorException({
        error: 'Error al consultar KPIs',
        detail: message,
        hint: 'Verifica DATABASE_URL/credenciales de Cloud SQL y la tabla public.factory_requests',
      });
    }
  }

  @Get('api/dashboard/requests-by-school-type')
  async getRequestsBySchoolAndType(): Promise<
    Array<{ school_norm: string; progress_type: string; total: number }>
  > {
    try {
      const rows = await this.db().$queryRawUnsafe<Array<Record<string, unknown>>>(
        REQUESTS_BY_SCHOOL_TYPE_SQL,
      );
      return (rows ?? []).map((row) => ({
        school_norm: String(row.school_norm ?? 'Sin clasificar'),
        progress_type: String(row.progress_type ?? 'Sin clasificar'),
        total: Number(row.total ?? 0),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error SQL no identificado';
      this.logger.error(`getRequestsBySchoolAndType: ${message}`);
      throw new InternalServerErrorException({
        error: 'Error al consultar distribucion por escuela/tipo',
        detail: message,
        hint: 'Verifica DATABASE_URL/credenciales de Cloud SQL y columnas school/progress_type',
      });
    }
  }

  @Get('api/content/records')
  async getContentRecords(): Promise<{ total: number; rows: Array<Record<string, unknown>> }> {
    try {
      const totalRows = await this.db().$queryRawUnsafe<Array<{ total: bigint | number }>>(
        'SELECT COUNT(*)::bigint AS total FROM public.factory_requests;',
      );
      const payloadRows = await this.db().$queryRawUnsafe<Array<{ row: Record<string, unknown> }>>(
        CONTENT_RECORDS_SQL,
      );
      return {
        total: Number(totalRows?.[0]?.total ?? 0),
        rows: (payloadRows ?? []).map((entry) => entry.row ?? {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error SQL no identificado';
      this.logger.error(`getContentRecords: ${message}`);
      throw new InternalServerErrorException({
        error: 'Error al consultar contenido',
        detail: message,
        hint: 'Verifica DATABASE_URL/credenciales y acceso a public.factory_requests',
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma?.$disconnect();
  }
}
