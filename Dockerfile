# syntax=docker/dockerfile:1.7
###############################################################################
# tasainmuebles-web — Next.js 15 (App Router, SSR) → build "standalone".
#
# Imagen final mínima que corre el server Node en :3000. nginx va ADELANTE
# (ver nginx.conf) como reverse-proxy. El TLS se termina en el ALB/Ingress de
# AWS, así que esta imagen sirve HTTP plano.
#
# Build:
#   docker build \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
#     --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://app.tasainmuebles.com \
#     -t tasainmuebles-web:latest .
#
# El secreto server-only SUPABASE_SERVICE_ROLE_KEY NO se hornea: se inyecta en
# runtime vía K8s Secret / env var.
###############################################################################

ARG NODE_VERSION=22-alpine

# ---- deps: instala dependencias (capa cacheable mientras no cambie el lock) --
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compila la app a output standalone -----------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Las NEXT_PUBLIC_* se INLINEAN en el bundle del cliente en build time.
# No son secretos (la anon key es pública), por eso van como --build-arg.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1

# public/ puede no existir todavía; lo garantizamos para el COPY del runner.
RUN mkdir -p public && npm run build

# ---- runner: imagen final mínima, non-root -----------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Usuario sin privilegios
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# Output standalone: server.js + node_modules mínimos + estáticos + public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# Healthcheck contra el server de Next (node 22 trae fetch global)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
