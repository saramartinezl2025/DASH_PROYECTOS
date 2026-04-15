import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { CorsOptions } from 'cors';
import cors from 'cors';
import { AppModule } from './app.module';

const bootstrapLogger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  bootstrapLogger.log('Creando aplicación Nest…');
  const app = await NestFactory.create(AppModule);

  // Reflejar el Origin evita que un 500 sin cabeceras CORS se vea en el front como "Failed to fetch"
  // aunque en Red aparezca 500. Sin cookies en el API: credentials false.
  const corsOptions: CorsOptions = {
    origin: true,
    credentials: false,
  };
  app.use(cors(corsOptions));
  bootstrapLogger.log('CORS: origin reflejado (cualquier front puede consumir este API en navegador).');

  const port = Number(process.env.PORT) || 3030;
  await app.listen(port, '0.0.0.0');
  bootstrapLogger.log(`Escuchando en 0.0.0.0:${port}`);
}

void bootstrap();
