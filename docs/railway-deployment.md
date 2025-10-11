# Railway Deployment Guide

## Variables y secretos
- Define los secretos en Railway → **Variables**. Usa scopes (`Production`, `Staging`, `Preview`) para evitar fugas entre entornos.
- Agrupa claves compartidas en **Variable Groups** y asígnalos a cada servicio para mantener consistencia.
- Mantén `.env` solo para desarrollo local; sincroniza los cambios con `dotenvx` agregando los secretos ficticios necesarios en `.env.example`.
- En Railway activa `Sync .env files` únicamente si necesitas exportarlos temporalmente; vuelve a desactivar para prevenir sobreescrituras accidentales.

## Despliegues automáticos
- Conecta el repo de GitHub y elige la rama `main` para **Auto Deploy**.
- Activa **Preview Deployments** para PRs: Railway creará entornos efímeros vinculados al número de PR.
- Protege `main` con el workflow de CI (ver `.github/workflows/ci.yml`) para asegurar lint y type-check antes de liberar un deploy.
- Ejecuta `npm run deploy` en tus pipelines: compila y hace `npm prune --omit=dev` para reducir el footprint final.
- Usa el botón **Redeploy** solo en incidentes; confía en el pipeline para mantener historial de builds.

## Recursos y escalado
- Observa CPU y RAM en `Insights`. Si superas el 70 % de forma sostenida, sube el plan o mueve el servicio a un `machine type` mayor.
- Configura `Restart Policy` en Railway para reinicios automáticos ante caídas. Si detectas memory leaks, añade un `Scheduled Restart` diario.
- Añade un servicio de base de datos dedicado (MySQL/PostgreSQL) si la carga de transacciones crece; evita compartir instancias con entornos de prueba.

## Manejo de errores y observabilidad
- Habilita una herramienta de APM/logging externa (Logtail, Better Stack, Sentry, etc.) para mantener trazas históricas.
- Centraliza las claves de cada servicio en Railway y usa scopes para evitar filtraciones entre entornos.
- Si optas por logs en archivos, monta un servicio sidecar o usa buckets externos; evita saturar el stdout de Railway.

## Operación diaria
- Usa `railway logs -s finanzas-app` para inspección rápida y apóyate en tu herramienta externa para trazas históricas.
- Documenta cambios de infraestructura en `docs/TECHNICAL_AUDIT.md` para mantener contexto del equipo.
- Automatiza backups de la base de datos con Railway `Backups` o un cron serverless (Workers/CRON) que consuma la API SQL.

---

Este documento complementa las guías de seguridad (`docs/SECURITY.md`) y optimización (`docs/optimization-guide.md`).
