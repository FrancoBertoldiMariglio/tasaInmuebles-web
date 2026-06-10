# CLAUDE.md — tasainmuebles-web

Dashboard B2B de Tasa Inmuebles. Next.js 15 (App Router) + Supabase. App en la raíz del repo.
Deploy: Docker standalone (`output: 'standalone'`) + nginx en K8s (EKS).

## Branches: feature → develop → staging → main (todo vía MR)
- `feature/<ctx>-<desc>`: off `develop` → push de la rama → **MR a develop**. No se mergea local.
- `develop`: integración. Solo MR desde `feature/*`.
- `staging`: candidato TEST. Solo MR desde `develop`.
- `main`: prod. Solo MR desde `staging`.
- Promoción: `develop →MR→ staging →(TEST ok)→MR→ main`.

## CI/CD (.gitlab-ci.yml)
- Gates bloqueantes en cada MR: `npm run lint` + `npm run typecheck` (validate), `npm run test:coverage` (test), `npm run build` (build).
- `guard`: el pipeline falla si la fuente del MR no es la permitida para la target (main←staging, staging←develop, develop←feature/*).
- `deploy`: diferido (manual, comentado) hasta tener registry/EKS/secrets.

## Antes de cualquier PR
- `npm run lint && npm run typecheck && npm run test:coverage && npm run build`

## Más contexto
- Política canónica de los 3 repos: `../docs/superpowers/specs/2026-06-10-pipelines-3repos-design.md` (workspace Cocucci).
