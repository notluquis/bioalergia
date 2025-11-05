# DaisyUI / Theme tokens — Context7 doc (finanzas-app)

This document provides quick, practical guidance and examples for using DaisyUI theme tokens and migrating legacy `glass-*` / `bg-white` visuals to semantic classes in this repository.

Why this file

- The project standard is to use DaisyUI semantic tokens and keep them as the single source of truth for theming. This doc helps developers and AI agents understand mapping, examples, and migration patterns.

Core DaisyUI tokens we use (examples)

- Surface / cards: `bg-base-100`, `card`, `rounded-2xl`, `shadow`
- Raised surface / emphasis: `bg-base-200`, `border`, `ring`
- Primary / brand: `text-(--brand-primary)` or `text-primary` / `btn btn-primary`
- Secondary: `text-(--brand-secondary)` or `text-secondary`
- Inputs: `input input-bordered`, `textarea textarea-bordered`, `select select-bordered`
- Buttons: `btn`, variants `btn-primary`, `btn-ghost`, `btn-outline` (we wrap them with `src/components/Button.tsx`)

Theme tokens in `tailwind.config.cjs`

- Two branded themes are declared: `bioalergia` and `bioalergia-dark`.
- Theme sets CSS variables such as `--brand-primary`, `--brand-secondary`, and `--brand-primary-rgb` used in `src/index.css` overlays.

Quick migration patterns (conservative)

- Replace: `class="glass-card glass-underlay-gradient ..."`
  - With: `class="card bg-base-100 rounded-2xl shadow p-4 ..."`
- Replace: `class="glass-input w-full"` → `class="input input-bordered w-full"`
- Replace: inline `style={{ background: '#fff' }}` → `className="bg-base-100"` or use `data-theme` token variables.

Automated search & codemod suggestions

- Grep to find legacy visuals:
  - `grep -R "bg-white\|glass-" src | sed -n '1,200p'`
- Codemod strategy (suggested): run a conservative replacement per file:
  1. Replace `glass-input` → `input input-bordered`.
  2. Replace `glass-card` / `glass-panel` → `bg-base-100 rounded-2xl shadow`.
  3. Manually verify components with complex gradients/overlays.

Examples

- Before

```tsx
<section className="glass-card glass-underlay-gradient p-6">
  <h2>Title</h2>
  <input className="glass-input" />
</section>
```

- After

```tsx
<section className="card bg-base-100 rounded-2xl p-6 shadow">
  <h2>Title</h2>
  <input className="input input-bordered w-full" />
</section>
```

Previewing theme changes locally

- Run the dev server and toggle theme in the UI (top-right ThemeToggle). Verify both `bioalergia` and `bioalergia-dark`.
- For visual diffs use: take light/dark screenshots before and after PR; include them in PR description.

When to ask a human

- If a component uses CSS variables or complex `backdrop-filter` effects that are intentionally part of the visual design, ask a designer before replacing.

Further reading

- `tailwind.config.cjs` — where DaisyUI theme tokens live.
- `src/index.css` — global overlays and layout helpers.

If you want, I can generate a codemod PR that replaces common patterns in a safe, file-by-file manner.

---

Generated for finanzas-app on Oct 31, 2025
