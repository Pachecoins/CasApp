# Tuki — Plataforma de servicios del hogar

> Conectá con los mejores profesionales del hogar. Jardinería, plomería, electricidad y más.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Base de datos | PostgreSQL 16 + Prisma ORM |
| Auth | JWT + bcrypt |
| Real-time | Socket.io |
| Monorepo | pnpm workspaces |

## Estructura del proyecto

```
casapp/
├── packages/
│   ├── client-app/     → App React para clientes (puerto 5173)
│   ├── worker-app/     → App React para trabajadores Tuki Pro (puerto 5174)
│   ├── api/            → Backend Express (puerto 3000)
│   └── shared/         → Tipos TypeScript y utils compartidos
├── prisma/
│   └── schema.prisma   → Schema completo de la base de datos
├── docker-compose.yml  → PostgreSQL + Redis
└── .env.example        → Variables de entorno requeridas
```

## Requisitos previos

- Node.js >= 20
- pnpm >= 8 (`npm install -g pnpm`)
- Docker + Docker Compose

## Setup inicial

### 1. Clonar e instalar dependencias

```bash
git clone <repo-url>
cd casapp
cp .env.example .env
pnpm install
```

### 2. Levantar la base de datos

```bash
docker compose up -d
```

### 3. Generar el cliente de Prisma y migrar la DB

```bash
pnpm db:generate
pnpm db:push
pnpm db:seed   # Carga las categorías de servicios
```

### 4. Iniciar el proyecto completo

```bash
pnpm dev
```

Esto levanta en paralelo:
- **API** → http://localhost:3000
- **Cliente App** → http://localhost:5173
- **Worker App (Tuki Pro)** → http://localhost:5174

## Endpoints de la API

### Auth
```
POST /api/auth/register/client   → Registro de cliente
POST /api/auth/register/worker   → Registro de trabajador
POST /api/auth/login             → Login (clientes y trabajadores)
POST /api/auth/refresh-token     → Renovar access token
GET  /api/auth/me                → Perfil del usuario autenticado
POST /api/auth/logout            → Cerrar sesión
```

### Categorías
```
GET /api/categories              → Listar categorías activas
GET /api/categories/:slug        → Detalle de categoría
```

### Health check
```
GET /health                      → Estado del servidor
```

## Variables de entorno

Copiá `.env.example` a `.env` y completá los valores:

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `DATABASE_URL` | URL de conexión PostgreSQL | Sí |
| `JWT_SECRET` | Secreto para firmar JWT | Sí |
| `MP_ACCESS_TOKEN` | Token de MercadoPago | Fase 4 |
| `CLOUDINARY_*` | Credenciales de Cloudinary | Fase 6 |

## Fases de desarrollo

- [x] **Fase 1** — Base, Auth, Monorepo (actual)
- [ ] **Fase 2** — Núcleo del pedido (on-demand y programado)
- [ ] **Fase 3** — Tracking en tiempo real (Socket.io + GPS)
- [ ] **Fase 4** — Pagos (MercadoPago)
- [ ] **Fase 5** — Suscripciones recurrentes
- [ ] **Fase 6** — Reseñas y perfiles con portfolio
- [ ] **Fase 7** — Notificaciones, panel admin, pulido

## Lógica de precios

| Modalidad | Multiplicador |
|-----------|--------------|
| On-demand | Base × 1.35 (+35%) |
| Programado | Base × 1.00 |
| Suscripción semanal | Base × 0.75 (-25%) |
| Suscripción quincenal | Base × 0.80 (-20%) |
| Suscripción mensual | Base × 0.85 (-15%) |

La plataforma cobra **20% de comisión** sobre el subtotal.
Pedidos on-demand entre las 20hs y las 8hs tienen **+20% nocturno**.

## Comandos útiles

```bash
pnpm dev:api      # Solo el backend
pnpm dev:client   # Solo la app de clientes
pnpm dev:worker   # Solo la app de trabajadores
pnpm db:studio    # Abrir Prisma Studio (UI para la DB)
pnpm db:seed      # Cargar datos iniciales
```
