# tasainmuebles-web

Dashboard **web B2B** de **Tasa Inmuebles** — la consola para entidades (bancos,
inmobiliarias, constructoras, juzgados, estudios) que solicitan y administran
tasaciones. Es uno de los 3 repos del producto:

| Repo | Rol | Plataforma |
|---|---|---|
| **tasainmuebles-web** (este) | Dashboard B2B: solicitar, asignar, seguir y consultar tasaciones; administrar miembros de la entidad. | Next.js 15 / Vercel o K8s |
| `tasainmuebles-mobile` | App de campo del **tasador** (ejecución de tasaciones) + autotasador B2C. | Expo / React Native |
| `tasainmuebles-docs` | Documentación de producto, requisitos, ADRs. | — |

> El **tasador** opera exclusivamente desde la app mobile (flujo de campo). Si un
> usuario con rol `tasador` se loguea acá, el middleware lo redirige a
> `/mobile-only`. El dashboard web es para roles `cliente_b2b`, `admin` y `comite`.

Backend compartido por los 3 frentes: **Supabase** (Postgres + Auth + Storage +
Realtime + Row Level Security). Este repo no tiene base propia; consume Supabase
vía SSR y RLS.

---

## 1. Stack

| Capa | Tecnología |
|---|---|
| Framework | **Next.js 15** (App Router, React Server Components) |
| UI | React 19 + **Tailwind CSS 3** |
| Lenguaje | TypeScript 5 (strict) |
| Auth / datos | **Supabase** vía `@supabase/ssr` + `@supabase/supabase-js` |
| Tipos de BD | `types/database.ts` autogenerado (`npm run gen:types`) |
| Runtime | Node.js 22 (server SSR) |
| Deploy | Docker (output standalone) + nginx reverse-proxy → **Kubernetes/AWS** (o Vercel) |

---

## 2. Composición del repo

```
tasainmuebles-web/
├── app/                          # App Router
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing pública (CTA a /login)
│   ├── login/                    # Login (email + password, Supabase Auth)
│   ├── aceptar-invitacion/       # Alta de miembro vía link de invitación
│   ├── mobile-only/              # Pantalla para roles que solo usan la app mobile
│   └── (b2b)/                    # Route group del dashboard (requiere sesión + rol web)
│       ├── layout.tsx            # Shell del dashboard (nav, selector de entidad)
│       └── dashboard/
│           ├── page.tsx          # Overview de la entidad activa
│           ├── tasaciones/       # Listado (con Realtime + filtros) y detalle [id]
│           │   ├── TasacionesRealtime.tsx   # Suscripción Realtime → refresca el listado
│           │   ├── TasacionesFilters.tsx
│           │   └── [id]/         # Detalle + asignación de tasador
│           ├── nueva/            # Crear una nueva solicitud de tasación
│           ├── miembros/         # ABM de miembros de la entidad
│           ├── invitar/          # Invitar usuarios (Admin API, service-role)
│           └── metricas/         # KPIs de la entidad
│
├── components/                   # UI compartida (EntidadSelector, MobileGate, NavLink, LogoutButton)
├── lib/
│   ├── supabase/                 # 4 clientes Supabase (ver §3)
│   │   ├── server.ts             #   RSC / Server Actions (cookies, getUserCached)
│   │   ├── client.ts             #   Browser
│   │   ├── middleware.ts         #   Refresh de sesión + guards (lo usa middleware.ts)
│   │   └── admin.ts              #   Service-role (Admin API, server-only)
│   ├── entidad-activa.ts         # Membresías del user + entidad activa (cookie)
│   ├── queries/                  # Lecturas reutilizables (ej. fotos)
│   ├── labels.ts  timezone.ts    # Helpers de presentación
├── middleware.ts                 # Edge middleware → updateSession()
├── types/database.ts             # Tipos generados del schema Supabase (gen:types)
│
├── Dockerfile                    # Build multi-stage → imagen standalone (ver §6)
├── nginx.conf                    # Reverse-proxy sidecar para K8s (ver §7)
├── .dockerignore
└── next.config.ts                # output: 'standalone' + outputFileTracingRoot
```

**Patrón de mutaciones:** cada ruta que escribe datos tiene su `actions.ts` con
**Server Actions** (`'use server'`). Los componentes de formulario las invocan
directamente; no hay capa de API REST propia — la lógica corre server-side y pega
a Supabase con la sesión del usuario (RLS aplica).

---

## 3. Autenticación y acceso a datos

La app usa **cuatro** clientes Supabase según el contexto de ejecución:

| Cliente | Archivo | Contexto | Para qué |
|---|---|---|---|
| **Server** | `lib/supabase/server.ts` | RSC / Server Actions | Lecturas/escrituras con la sesión del user (cookies). `getUserCached()` memoiza `getUser()` por request (React `cache()`) para evitar round-trips repetidos. |
| **Browser** | `lib/supabase/client.ts` | Cliente | Realtime y acciones desde el navegador. |
| **Middleware** | `lib/supabase/middleware.ts` | Edge middleware | Refresca la sesión SSR y reescribe cookies; aplica los guards. |
| **Admin** | `lib/supabase/admin.ts` | Server-only | **Service-role** (bypassa RLS) para la Admin API, ej. `inviteUserByEmail`. Marcado `import 'server-only'`: si llegara al bundle del cliente, **rompe el build**. |

### Guards del middleware (`lib/supabase/middleware.ts`)

Sobre cada request que matchea (todo excepto assets estáticos):

1. **Optimización:** si no hay cookie `sb-*`, no hay sesión que refrescar → se
   evita el round-trip a Supabase en rutas públicas (`/`, `/login`, `/mobile-only`).
2. **Auth guard:** rutas bajo `/dashboard` sin user → redirect a `/login?next=…`.
3. **Refresh de sesión:** `getUser()` refresca el token y reescribe cookies
   (imprescindible para SSR; no se puede saltear).
4. **Role guard:** el dashboard es solo para `cliente_b2b` / `admin` / `comite`.
   Un `tasador` autenticado → redirect a `/mobile-only`.

---

## 4. Modelo multi-entidad (B2B)

Un usuario puede pertenecer a varias **entidades** (`entidad_miembros` con
`roles[]`). El dashboard opera siempre sobre una **entidad activa**, persistida en
la cookie `entidad_activa` y cambiable con el `EntidadSelector`. `lib/entidad-activa.ts`
resuelve membresías y entidad activa (también memoizado con `cache()` por request).

Las tasaciones, miembros y métricas que ve el usuario están acotadas a su entidad
activa, reforzado por **RLS** en Supabase (la app nunca es la única línea de defensa).

---

## 5. Variables de entorno

> ⚠️ Las `NEXT_PUBLIC_*` se **inlinean en build time** en el bundle del cliente.
> La imagen Docker queda atada al environment con el que se buildeó.

| Variable | Ámbito | ¿Secreto? | Notas |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | build + runtime | No | URL del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | build + runtime | No | Clave anónima (pública por diseño; RLS protege). |
| `NEXT_PUBLIC_SITE_URL` | build + runtime | No | URL pública del sitio; `redirectTo` de los emails de invitación. |
| `SUPABASE_SERVICE_ROLE_KEY` | **runtime únicamente** | **Sí** | Service-role para la Admin API. **Nunca** en la imagen ni en el cliente: se inyecta por K8s Secret / env en runtime. |

Para desarrollo local, copiar `.env.local.example` → `.env.local` y completar.

---

## 6. Desarrollo local

Requisitos: Node.js 22, npm.

```bash
cp .env.local.example .env.local   # completar valores
npm install
npm run dev                         # http://localhost:3000
```

Otros scripts:

```bash
npm run build       # build de producción (genera .next/standalone)
npm run start       # sirve el build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run gen:types   # regenera types/database.ts desde el schema Supabase
```

---

## 7. Infraestructura

### Por qué NO es un sitio estático

Tiene **middleware de auth que corre en cada request** y **render server-side**
con cookies de Supabase (RSC + Server Actions). No se puede `output: 'export'` /
servir con nginx a secas: **necesita un server Node corriendo**. La arquitectura
de deploy es, por lo tanto, **server Next + nginx como reverse-proxy adelante**.

### Imagen Docker (`Dockerfile`)

Build multi-stage (`deps` → `builder` → `runner`) sobre `node:22-alpine`:

- `next.config.ts` con `output: 'standalone'` → la imagen final solo lleva
  `server.js` + los `node_modules` mínimos + estáticos (~**238 MB**).
- Corre como usuario **non-root** (`nextjs:nodejs`), expone **:3000**, `HEALTHCHECK` incluido.
- `outputFileTracingRoot` ancla el file-tracing a este repo (evita que un
  `package-lock.json` en un directorio padre desplace el `server.js`).
- Las `NEXT_PUBLIC_*` entran como `--build-arg`; `SUPABASE_SERVICE_ROLE_KEY` **no**
  se hornea (solo runtime).

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<proj>.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key> \
  --build-arg NEXT_PUBLIC_SITE_URL=https://app.tasainmuebles.com \
  -t <registry>/tasainmuebles-web:<tag> .
```

### Reverse-proxy nginx (`nginx.conf`)

nginx (imagen oficial `nginx:alpine`, sin Dockerfile propio) va de **sidecar** en
el mismo pod, escucha en **:8080** y proxea a `127.0.0.1:3000`. Aporta:

- **gzip** de respuestas de texto.
- **Cache inmutable** de `/_next/static/*` (`max-age=31536000, immutable`).
- **Headers de seguridad** (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).
- `X-Forwarded-*` correctos (el ALB de AWS setea `X-Forwarded-Proto`; Supabase SSR
  lo usa para las cookies `Secure`).
- Endpoint `/healthz` para las probes de K8s (no toca al server de Next).

El **TLS se termina en el ALB/Ingress** de AWS; nginx sirve HTTP plano puertas adentro.

```
Internet ──TLS──▶ ALB/Ingress (AWS) ──HTTP──▶ Service :8080
                                                  │
                                          ┌───────┴────────── Pod ───────────┐
                                          │  nginx :8080  ──▶  app :3000      │
                                          │  (sidecar)         (Next server)  │
                                          └───────────────────────────────────┘
```

---

## 8. Deploy en Kubernetes / AWS

**Topología:** un `Deployment` con **2 containers en el mismo pod**:

1. **app** — imagen `tasainmuebles-web`, puerto 3000, recibe
   `SUPABASE_SERVICE_ROLE_KEY` desde un `Secret`.
2. **nginx** — `nginx:alpine` con `nginx.conf` montado desde un `ConfigMap`,
   puerto 8080.

Más:

- **`Service`** (ClusterIP) → 8080, apuntando al pod.
- **`ConfigMap`** con el contenido de `nginx.conf` montado en `/etc/nginx/nginx.conf`.
- **`Secret`** con `SUPABASE_SERVICE_ROLE_KEY` (y opcionalmente las `NEXT_PUBLIC_*`
  si se prefieren en runtime, aunque ya están horneadas en build).
- **`Ingress`** (ALB Ingress Controller de AWS) termina TLS y rutea al Service.
- **Probes** de liveness/readiness → `GET http://:8080/healthz`.

> Las `NEXT_PUBLIC_*` se fijan en **build time** (un build/imagen por environment).
> Pipeline sugerido: build con los `--build-arg` del entorno → push al registry
> (ECR) → `kubectl set image` / GitOps.

Los manifiestos YAML (`Deployment` + `Service` + `ConfigMap` + `Secret` + `Ingress`)
viven fuera de este repo (infra). Generarlos siguiendo la topología de arriba.

### Alternativa: Vercel

El repo también despliega en **Vercel** sin Docker (Next.js nativo). Setear las
4 variables de entorno en el proyecto Vercel. El `Dockerfile`/`nginx.conf` son
para el camino K8s/AWS.

---

## 9. Git / repos

- Remoto: `git@gitlab.com:inmoclick-dev/tasainmuebles.git` (este repo = **solo web**).
- Forma parte del workspace `Cocucci/`; ver `../CLAUDE.md` §7 para el layout de los 3 repos.

### Estrategia de ramas

```
develop ──▶ staging ──▶ main
(integración)  (QA/pruebas)  (producción, protegida)
```

| Rama | Propósito | Deploy |
|---|---|---|
| `develop` | Integración del trabajo diario. Base de la que salen las features. | Preview / dev |
| `staging` | Estabilización y pruebas (QA, demos, validación) antes de prod. | Entorno de staging |
| `main` | Producción. **Protegida** (no se commitea directo). | Producción |

Promoción siempre hacia adelante: `develop → staging → main` (vía merge/MR). El
README y todo el código viajan con los merges, por eso **el README es único y
branch-agnóstico** (no se mantiene una versión por rama). Lo que difiere entre
entornos son las **variables de entorno** (§5), no el código ni la doc.
