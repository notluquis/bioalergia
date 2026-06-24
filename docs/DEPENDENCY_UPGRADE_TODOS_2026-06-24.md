# Dependency Upgrade TODOs - 2026-06-24

Follow-ups intentionally skipped during the full dependency upgrade because they
need product or infrastructure decisions beyond a safe merge.

- Graphile bulk/job batching: revisit only when we have a real bulk enqueue path.
  Current jobs mostly enqueue single chains, so the new batching APIs would add
  plumbing without a caller.
- PostHog logs/session capture: keep disabled unless we define a PHI-safe capture
  policy for the health app. Do not enable broad session or console capture by
  default.
- lucide-react icon accessibility/cosmetic sweep: audit touched screens when a
  feature already modifies them. Avoid a repo-wide visual churn PR just for icon
  replacements.
- ZenStack soft-delete helpers: evaluate as a schema/business-rule project, not
  as part of dependency maintenance. It changes data semantics and query behavior.
- HeroUI composition migration: run targeted audits when a component is touched
  or a test/type error demands it. No mass refactor was needed for this upgrade.
- Vite/PWA `inlineDynamicImports` warning: appears to come from upstream plugin
  internals, not local config. Recheck on the next vite-plugin-pwa bump before
  changing build config.
