# gestion-proyectos-backend

Backend minimo con NestJS + Prisma + PostgreSQL, listo para desplegar en Google Cloud Run.

## Requisitos

- Node.js 20
- PostgreSQL disponible
- Variable `DATABASE_URL` configurada

## Endpoints

- `GET /` -> `{ "message": "gestion-proyectos-backend up" }`
- `GET /health` -> `{ "status": "ok" }`

## Variables de entorno

Copia `.env.example` a `.env` y ajusta:

```bash
PORT=8080
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gestion_proyectos?schema=public"
```

## Comandos exactos

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
npm run build
gcloud run deploy gestion-proyectos-backend --source . --region us-central1 --allow-unauthenticated
```

## Cloud Run

- La app arranca con `process.env.PORT || 8080`.
- El servidor escucha en `0.0.0.0`.
- El `Dockerfile` usa Node 20 y compila Nest en `dist/`.
