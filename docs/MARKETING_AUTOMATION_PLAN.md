# Bioalergia — Plan de automatización de redes sociales

> Autoría: plan técnico end-to-end. Estado: propuesta para aprobación.
> Última actualización: 2026-06-15.

---

## ⚠️ DECISIÓN FINAL (2026-06-15) — SUPERSEDE lo de abajo

Tras evaluar Postiz (self-host Temporal pesado + rate-limit), SaaS API-first (Postproxy/SocialAPI.ai/Blotato/Ayrshare) y Mixpost, la decisión es **BUILD NATIVO, CERO SaaS recurrente**:

- **Generación = Claude Code** (suscripción ya pagada, $0 incremental): copy + **Satori → PNG** (posts/stories/carrusel, corre en Node 26) + **Remotion → MP4** (reels). Opcional, centavos por uso: Claude llama **Recraft/Gemini** (imagen hero) o **Kling 3.0** (video cinematic, ~$0.07/seg) solo cuando un post lo amerite.
- **Publicación = construida en `apps/api`** (Hono/oRPC): **Meta Graph API** (IG feed/reels/stories/carrusel + FB Page), **TikTok Content Posting API** (tras audit), **WhatsApp = WA Cloud existente**. Scheduling = **graphile-worker** (ya existe). Media = **R2** (ya existe; Meta/TikTok exigen URL pública del archivo, R2 la sirve).
- **Aprobación = `apps/intranet`**: tabla ZenStack `SocialPost` + panel HeroUI v3 (calendario, preview por red, aprobar/editar/rechazar → al aprobar encola en graphile-worker). Modo **approval-first**.
- **Infra**: todo en Railway/stack actual. **$0 recurrente nuevo** (Claude Code + Railway + R2 ya pagados). Budget ~50k CLP/mo queda libre para **pauta paga** (Meta/TikTok ads), no para tooling.
- **Postiz DESCARTADO** (v2.11.3+ requiere Temporal = 8 servicios; deploy Railway `independent-consideration` quedó roto → **BORRAR**, liberar dominio `social.bioalergia.cl`).
- **Cuello**: App Review + Business Verification de Meta (ya iniciado en Fase 0, misma app que WhatsApp) — corre mientras se construye.

Trade-off aceptado: más trabajo de build (OAuth Meta + refresh token + media container + polling + TikTok audit) a cambio de $0 mensual, control total y brand-perfect.

**Plataformas/formatos**: ver §1.1 (sin cambios). IG/FB = post+reel+story API; TikTok = video, sin stories, audit; WhatsApp broadcast (WA Status + Channels = manual, sin API).

> Lo que sigue abajo (capas Postiz, comparativas) queda como **registro histórico** de cómo se llegó acá. La arquitectura vigente es esta sección.

---
> Decisiones tomadas (2026-06-15): **motor = Postiz self-host** · **modo = approval-first** · **generación = código React: Satori (PNG) + Remotion (MP4) + IA imagen opcional, NO Canva** · **aprobación = ambos (Postiz nativo + panel intranet)** · **generación corre en CLI/local ahora, graphile-worker en Fase 2** · este documento = entregable previo a construir.
>
> Estado Fase 0 (2026-06-15): IG Business/Creator linkeado a FB Page ✅ · Meta App + Business Verification iniciada ✅ (es la **misma Meta App que ya usa WhatsApp Cloud** → agregar permisos IG/FB content publish a esa app, dispara otro App Review).

## 0. Objetivo

Automatizar la mayor parte posible del marketing en redes (Instagram, Facebook, TikTok, WhatsApp broadcast + Channels) para Bioalergia, reemplazando la contratación de un community manager por un pipeline **Claude (genera copy + HTML/Remotion) → render a PNG/MP4 → tú apruebas → Postiz publica**, con costo de software $0 (solo infra Railway que ya pagas).

Dos problemas distintos, no confundir:
1. **Publicar** (distribución multi-red, scheduling, OAuth) → resuelto por Postiz.
2. **Crear** contenido nuevo (copy + arte) → resuelto por Claude + Canva MCP + reuso de `CONTENIDO`.

El archivo actual en `OneDrive/BIOALERGIA/CONTENIDO/03_Elementos gráficos` es material de marca (folletos test cutáneo, BACTEK, logos, design system HTML/MD, 1 reel mp4), **no** un backlog grande de posts. Por eso la capa de *creación* pesa tanto como la de publicación.

---

## 1. Realidad por plataforma (verificado 2026-06)

| Plataforma | API posting | Detalle | Veredicto |
|---|---|---|---|
| Instagram feed/reels/carrusel | ✅ completo | Meta Graph API Content Publishing. Requiere cuenta IG **Business/Creator** + FB Page linkeada + Meta App. Límite 25 posts/24h. Reels = paso de polling (~30s-2min) mientras procesa el video. | Fase 1 |
| Facebook Page | ✅ completo | Misma Meta App / Graph API. | Fase 1 |
| WhatsApp broadcast (opt-in) | ✅ **ya cableado** | `apps/api/src/modules/wa-cloud` + `broadcast-runner.ts` + cola graphile-worker (`send_wa_broadcast_tick`). Opt-in en `Person` ya respeta Ley 21.719. | Fase 1 (reuso) |
| TikTok | ⚠️ parcial | Content Posting API existe pero: (a) audit de la app 1-2 semanas; (b) hasta aprobar, todo post es `SELF_ONLY` (solo el dueño lo ve); (c) **video-only**, sin carrusel de fotos; (d) 25 vids/día. | Fase 2 |
| X / LinkedIn / Threads / etc. | ✅ vía Postiz | Postiz soporta 30+ redes con su propio OAuth. Activar si hace sentido. | Opcional |
| **WhatsApp Channels** | ❌ **sin API oficial** | Meta NO expone API para Channels. Solo manual en la app, o APIs no-oficiales (WAHA, Whapi, Maytapi — QR scrape estilo whatsapp-web). **Riesgo de ban/ToS inaceptable para marca médica.** | Manual |
| **WhatsApp Status** | ❌ **sin API oficial** | El "estado/historia" de WhatsApp tampoco tiene API. "Historias diarias en WhatsApp" = manual. | Manual |

### 1.1 Realidad por formato (posts / reels / stories)

| | Post feed | Reel/video | Story |
|---|---|---|---|
| Instagram | ✅ API | ✅ API | ✅ API |
| Facebook | ✅ API | ✅ API | ✅ API |
| TikTok | foto (sin carrusel) | ✅ API (tras audit) | ❌ no existe el concepto |
| WhatsApp | broadcast opt-in | broadcast media | ❌ Status sin API → manual |

Notas:
- "Stories diarias" automáticas = solo IG + FB. WhatsApp Status y Channels = manual. TikTok no tiene stories.
- Límite IG = 25 publicaciones/24h por API e incluye stories → con stories diarias hay margen de sobra.
- **Verificar en build si Postiz publica Stories** (su foco histórico son posts/reels). Si hay gap, las stories diarias van directo por Graph API desde nuestro código, no por Postiz.

Fuentes: [Meta IG Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/) · [TikTok Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started) · [WhatsApp Channels sin API oficial (WAHA)](https://waha.devlike.pro/whatsapp-channels/) · [Postiz API docs](https://docs.postiz.com/public-api/introduction) · [Remotion](https://www.remotion.dev/).

---

## 2. Arquitectura

```
            ┌──────────────────────────────────────────────┐
            │  CAPA 1 — GENERACIÓN (reemplaza al CM)         │
            │                                                │
  cron/     │  Claude agent (/schedule cloud o CLI)          │
  manual ──▶│   • calendario editorial (temas alergia)       │
            │   • copy en voz clínica (es-CL, sin claims)    │
            │   • selecciona/recicla assets de CONTENIDO     │
            │            │                                   │
            │            ▼                                   │
            │  Canva MCP  → arte desde brand kit → PNG/MP4   │
            └────────────┬───────────────────────────────────┘
                         │  drafts (copy + media + fecha sugerida)
                         ▼
            ┌──────────────────────────────────────────────┐
            │  CAPA 2 — APROBACIÓN (approval-first)          │
            │  Panel: ver draft → editar → aprobar/rechazar │
            │  (opción A: UI propia mínima en intranet       │
            │   opción B: usar el calendario de Postiz)      │
            └────────────┬───────────────────────────────────┘
                         │  aprobados → push API
                         ▼
            ┌──────────────────────────────────────────────┐
            │  CAPA 3 — PUBLICACIÓN                          │
            │                                                │
            │  Postiz (Railway) ─OAuth+schedule─▶ IG/FB/TikTok/X
            │  WA Cloud existente ─broadcast────▶ WhatsApp opt-in
            │  Manual ─────────────────────────▶ WA Channels  │
            └──────────────────────────────────────────────┘
```

**Por qué Postiz y no construirlo**: replicar OAuth + refresh de token + manejo de contenedores de media + reintentos + scheduling para 5+ redes son semanas de trabajo y mantención perpetua (Meta/TikTok rompen APIs seguido). Postiz es open-source (AGPL-3.0, ~31k stars en GitHub, mantención diaria), expone **public API + servidor MCP**, y tiene template oficial de Railway. Self-host = $0 licencia, datos en tu infra. Es el clásico "no reinventes el scheduler".

---

## 3. Componentes en detalle

### 3.1 Postiz (motor de publicación)

- **Deploy**: [template Railway "Postiz (Temporal)"](https://railway.com/deploy/postiz). Desde v2.12 Postiz usa Temporal como orquestador async (scheduling, refresh OAuth, etc.) → hay que usar el template Temporal, NO el viejo "Postiz App" (ese solo sirve ≤ v2.11).
- **Servicios que levanta**: app (web+API, puerto 4007 para API) + Postgres + Redis + Temporal. Imagen `ghcr.io/gitroomhq/postiz-app`.
- **Costo**: dentro del Hobby de Railway que ya usas (~$5/mo de infra incremental). Software $0.
- **Aislamiento**: proyecto Railway **separado** del de Bioalergia (api/intranet). No mezclar con la DB clínica (PHI). Postiz tiene su propia Postgres.
- **API**: cada red tiene su settings schema; el objeto `settings` debe incluir `__type` con el provider. Auth por API key de Postiz. Esto es lo que Claude usa para empujar los posts aprobados.
- **Dominio**: subdominio propio (ej. `social.bioalergia.cl`) vía Railway domain + DNS.

### 3.2 Conexión de redes (one-time setup)

1. **Meta (IG + FB)**:
   - Cuenta Instagram debe ser **Business o Creator** (no personal).
   - Linkear IG a una **Facebook Page**.
   - Crear **Meta App** (developers.facebook.com) tipo Business.
   - Permisos: `instagram_basic`, `instagram_content_publish`, `pages_manage_posts`, `pages_read_engagement`. Algunos requieren **App Review de Meta** (días a 1-2 semanas) + **Business Verification**.
   - Postiz maneja el OAuth flow; tú solo apruebas en el popup.
2. **TikTok** (Fase 2): registrar app en developers.tiktok.com, habilitar Content Posting API, pasar el **audit** (1-2 semanas). Hasta aprobar, posts `SELF_ONLY` → útil solo para probar el pipeline, no para publicar real.
3. **X / LinkedIn / Threads**: OAuth directo en Postiz, sin review pesado. Activar bajo demanda.

### 3.3 WhatsApp (reuso de lo existente)

- **Broadcast opt-in**: ya cableado (`broadcast-runner.ts`, `send_wa_broadcast_tick`, `enqueueJob`). El pipeline de aprobación puede encolar un broadcast igual que encola un post de Postiz. Respetar opt-in (`Person`) y plantillas aprobadas por Meta.
- **Channels**: sin API → **manual**. Recomendación: cuando un post se aprueba y es apto para Channel, el sistema deja el copy + media listos para copiar/pegar (o exporta a una carpeta), y un humano lo publica en la app. NO usar WAHA/Whapi en una marca médica (riesgo ban + posible exposición de número clínico).

### 3.4 Generación de contenido (código React, NO Canva)

**Decisión: dropear Canva. Stack = Satori + Remotion (mismos componentes React) + IA de imagen opcional para hero.** Investigado 2026 (ver §3.4.1). Generación por código gana: versionada, coherente de marca, Claude escribe JSX, $0, sin auth flaky de MCP. El flujo actual (`render_*.py` = HTML→Playwright→PNG) queda solo como fallback para folletos complejos.

- **Claude (este CLI on-demand ahora; graphile-worker en Fase 2)**:
  - Input: temas (calendario alergia: polen estacional Bío Bío, test cutáneo, inmunoterapia, BACTEK, prevención, mitos), tono y reglas de `CONTENIDO/README.md` + `bioalergia_design_system.md` (es-CL, sin em-dash, sin claims inventados, ojo "cura").
  - Output: N drafts = `{copy, hashtags, cta, formato (post|reel|story), template+data, fecha_sugerida, red_destino[]}`.
  - Reusa assets existentes (`03_Elementos gráficos/*`) cuando aplican.
- **Imágenes (posts + stories) → Satori** ([vercel/satori](https://www.npmjs.com/package/satori)): JSX + CSS inline → SVG → PNG (resvg/sharp). ~50-200ms, ~10MB, **in-process en Node 26** (corre directo en graphile-worker, sin Chrome). Formatos: feed 1080×1350 (4:5), cuadrado 1080×1080, story 1080×1920 (9:16). Claude rellena el componente; render determinístico. Limitación: subset de CSS (sin z-index, grid limitado) → ok para cards sociales; folletos complejos = fallback Playwright.
- **Video (reels + TikTok) → Remotion** ([remotion.dev](https://www.remotion.dev/)): React → MP4. Calza React 19. Composiciones 9:16, Claude escribe JSX, `npx remotion render` → MP4. Self-render local $0 (Lambda opcional). `bioalergia-reel-final.mp4` = referencia de estilo. Skill de Claude Code disponible.
- **Hero imagery opcional (Fase 2+) → modelo IA, solo ilustración/fondo**: cuando un post necesita imagen generada (no card plana). **El texto/logo/layout SIEMPRE va en la capa Satori, nunca baked por IA** (cero typos, control de claims, fuente de marca). Candidatos: **Nano Banana 2 / Gemini 3.1 Flash Image** (image-to-image con refs de marca, rápido, barato, ya hay stack Google) · **Recraft V4** (design taste + SVG + brand consistency) · Ideogram 3.0 (texto, no necesario). NO usar imágenes con texto generado por IA en contexto médico.
- **Clave arquitectónica**: Satori y Remotion comparten el paradigma JSX → un set de componentes de marca renderiza a PNG **y** MP4. Un solo design system en código para imagen + video.
- Pipeline de render como paquete en el repo (no OneDrive): `packages/social-render` (componentes React compartidos Satori+Remotion) o `apps/api/scripts/social/`.

#### 3.4.1 Por qué este stack (research 2026)

- **Satori vs Playwright**: 50-200ms vs 2-5s; 10MB vs Chrome 200MB+; in-process vs proceso aparte. Para cards repetitivas (stories diarias) Satori es netamente superior. [Comparativa](https://www.dunetools.com/guides/html-to-image-developers/).
- **Canva**: descartado (ya dio problemas + auth flaky + no versionable).
- **APIs de plantilla pagas** (Bannerbear/Placid/Templated $29+/mo): redundantes con Satori self-host. Descartadas. OSS RendrKit existe pero innecesario.
- **Posts full-IA con texto**: descartado por riesgo claim/typo en marca médica. IA = solo imagen, texto determinístico.
- Modelos IA imagen 2026: [leaderboard](https://llm-stats.com/leaderboards/best-ai-for-image-generation) — Nano Banana 2 (overall), Recraft V4 (diseño/marca/SVG), Ideogram 3.0 (texto), Seedream 4 (6 refs brand), Imagen 4 Ultra (fotorrealismo).

### 3.5 Capa de aprobación

**Decisión: ambos (correr en paralelo y comparar).**
- **A — Postiz directo**: Claude empuja drafts como *draft/scheduled* en Postiz; aprobás en su calendario. Cero código. Disponible Fase 1 día 1.
- **B — panel intranet**: ruta nueva en `apps/intranet` (HeroUI v3 + DataTable) que lista drafts (tabla `SocialDraft` en ZenStack), aprobar/editar/rechazar. Al aprobar → push Postiz API y/o encola WA broadcast. Empezar como **redirect/embed** a Postiz (rápido), evolucionar a panel propio si gana. Un solo lugar para todo (redes + WhatsApp + pacientes), en tu stack.

Plan: arrancar con A funcionando, montar B en paralelo (primero embed, después nativo). Vos decidís cuál queda tras unas semanas de uso.

Recomendación: **arrancar con A** (rápido, valida el pipeline), migrar a B si el volumen lo justifica.

---

## 4. Workflow approval-first

**Cadencia objetivo (ajustable): 1 publicación de feed/semana + 1 story/día.**

Semanal (ej. lunes):
1. Claude genera el lote de la semana: 1 post feed (+reel si aplica) + 7 stories + copy/hashtags/CTA. Render: HTML→PNG (imágenes/stories), Remotion (reels).
2. Drafts → Postiz *draft* (y/o panel intranet).
3. Revisás (~10-15 min): editás copy, cambiás arte, ajustás fecha, aprobás/descartás todo el lote.
4. Postiz publica en las fechas/horas aprobadas: post el día fijado, 1 story/día en IG+FB.
5. WhatsApp broadcast a opt-in se encola al aprobar (si el draft lo marca).
6. WhatsApp Channel + Status: copy+media exportados → publicación manual (sin API).

Hands-off real: ~10-15 min/semana de revisión. Sin CM contratado. Stories diarias salen del mismo lote aprobado el lunes (no requieren toque diario).

> Nota: si Postiz NO agenda Stories, las 7 stories/semana se publican por Graph API directo desde un task graphile-worker (Fase 2). Verificar capacidad de Postiz en Fase 1.

---

## 5. Compliance (no saltarse)

- **Publicidad de salud en Chile**: prohibido prometer resultados/curas. Revisar `CONTENIDO/03_Elementos gráficos/ALERGIA CURA.jpg` — el copy generado NUNCA debe afirmar "cura". Regla ya está en `CONTENIDO/README.md` ("no inventar dosis/cifras", es-CL profesional).
- **Ley 21.719** (vigente 1-dic-2026): WhatsApp broadcast solo a opt-in (ya implementado). No usar datos de pacientes para targeting publicitario sin base legal.
- **Datos**: Postiz en proyecto Railway aparte, sin acceso a la DB clínica. Cero PHI en el pipeline de marketing.
- **Voz de marca**: cargar el design system + reglas como system prompt del agente para consistencia.

---

## 6. Costos

| Ítem | Costo |
|---|---|
| Postiz (software) | $0 (open-source self-host) |
| Railway infra Postiz (app+PG+Redis+Temporal) | ~$5/mo incremental |
| Meta Graph API | $0 |
| TikTok API | $0 |
| WhatsApp Cloud broadcast | per-message Meta (ya lo asumes) |
| Canva | plan que ya tengas; brand templates en Free/Pro |
| Claude (generación) | tu suscripción/API actual |
| **Community manager humano** | **$0 (eliminado)** |

---

## 7. Rollout por fases

**Fase 0 — prerequisitos (tú, fuera de código)** ✅ hecho
- [x] IG Business/Creator linkeado a FB Page.
- [x] Meta App + Business Verification iniciada (misma app que WhatsApp Cloud → agregar perms IG/FB content publish ahí).
- [x] Design system listo (`bioalergia_design_system.md`) — se usa como tokens, sin Canva.

**Fase 1 — publicar IG/FB + reuso WA + render por código (semana 1-2)**
- [ ] Deploy Postiz (Temporal) en Railway, proyecto separado, dominio.
- [ ] Conectar IG + FB en Postiz (OAuth) — agregar perms `instagram_content_publish` etc. a la Meta App existente (dispara App Review).
- [ ] Probar push manual de 1 post vía API de Postiz.
- [ ] **Verificar si Postiz publica Stories** (decide si stories van por Postiz o Graph API directo).
- [ ] Pipeline render: template HTML→PNG (formatos 4:5 / 1:1 / 9:16) reusando patrón `render_test_cutaneo.py`.
- [ ] Pipeline Claude: generar 1 semana de drafts (copy + render) on-demand vía CLI.
- [ ] Aprobación A (Postiz) funcionando + B embed (redirect intranet a Postiz).

**Fase 2 — TikTok + video + automatización (semana 3-4)**
- [ ] Setup Remotion para reels/TikTok (composición 9:16, render local).
- [ ] Registrar app TikTok, iniciar audit (lento, `SELF_ONLY` hasta aprobar).
- [ ] Mover generación a task graphile-worker (cron semanal, llama Claude API) → drafts en tabla `SocialDraft`.
- [ ] Panel intranet B nativo (HeroUI DataTable, aprobar/editar/rechazar).
- [ ] Stories diarias por Graph API directo si Postiz no las cubre.

**Fase 3 — pulido**
- [ ] Métricas (engagement) de vuelta a un dashboard intranet.
- [ ] WA Channel + Status: flujo de export para publicación manual rápida.
- [ ] Afinar cadencia según resultados.

---

## 8. Riesgos / caveats

- **Meta App Review/Business Verification** es el cuello de botella (días-semanas). Empezar Fase 0 ya.
- **TikTok audit** lento + `SELF_ONLY` hasta aprobar + video-only. No bloquear el resto por TikTok.
- **WA Channels + Status** sin API oficial → manual; no caer en APIs no-oficiales (ban/ToS).
- **Postiz Stories**: no garantizado que agende stories; verificar en Fase 1, fallback Graph API directo.
- **Postiz AGPL**: ok para self-host interno; si algún día se ofrece como servicio a terceros, revisar obligaciones AGPL.
- **App Review Meta** al agregar content-publish a la app de WhatsApp: no romper los permisos WA existentes; revisar en sandbox/test users primero.
- **Claims médicos**: el guardrail de copy es crítico; revisión humana (approval-first) lo cubre.

---

## 9. Decisiones (resueltas 2026-06-15)

1. Aprobación: **ambos** — A (Postiz) arranca, B (intranet) en paralelo (embed → nativo). ✅
2. Generación: **código (HTML→PNG + Remotion), NO Canva**. ✅
3. Plataformas: IG + FB + TikTok + WhatsApp, formatos post/reel/story donde la API lo permite (ver §1.1). X/LinkedIn opcional vía Postiz.
4. Cadencia: **1 post feed/semana + 1 story/día** (ajustable). ✅
5. Runner generación: **CLI/local ahora**, graphile-worker (Fase 2). ✅

Pendiente menor: proyecto Railway para Postiz = ¿nuevo proyecto en tu workspace actual? (asumo que sí, aislado de la DB clínica).
