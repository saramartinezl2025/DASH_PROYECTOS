import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { CorsOptions } from 'cors';
import cors from 'cors';
import { AppModule } from './app.module';

const bootstrapLogger = new Logger('Bootstrap');

function collectCorsOrigins(): string[] {
  const fromCsv = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const fromSingle = (process.env.FRONTEND_URL || '').trim();
  const merged = [...fromCsv, ...(fromSingle ? [fromSingle] : [])];
  return [...new Set(merged)];
}

async function bootstrap(): Promise<void> {
  bootstrapLogger.log('Creando aplicación Nest…');
  const app = await NestFactory.create(AppModule);
  const corsOrigins = collectCorsOrigins();

  // Middleware explícito: las respuestas de error también llevan cabeceras CORS
  // (evita que el navegador oculte un 500 útil detrás de "blocked by CORS policy").
  const corsOptions: CorsOptions = {
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  };
  app.use(cors(corsOptions));

  const port = Number(process.env.PORT) || 3030;
  await app.listen(port, '0.0.0.0');
  bootstrapLogger.log(`Escuchando en 0.0.0.0:${port}`);
}

void bootstrap();
