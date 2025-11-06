# Design System: Apple-like + DaisyUI

## Quick Rules (Follow These)

1. **No hard-coded colors:** Use DaisyUI tokens (`primary`, `success`, `error`) or CSS variables
2. **No hard-coded shadows:** Use `shadow-sm`, `shadow-md`, `shadow-lg` from Tailwind
3. **Typography:** Use `.h1-apple`, `.h2-apple`, `.h3-apple`, `.body-apple`, `.caption-apple`
4. **Spacing:** Use `section-spacing-apple`, `container-padding-apple`, `card-padding-spacious`
5. **Animations:** Use `animate-fade-in`, `animate-scale-in` with `ease-[var(--ease-apple)]`

## Color Mapping

```
primary       → #0e64b7 (brand blue, light) / #7fb6ff (dark)
secondary     → #f1a722 (brand orange, light) / #ffc782 (dark)
success       → #36d399 / #34d399
error         → #f87272 / #fb7185
warning       → #fbbd23 / #fbbd23
info          → #3abff8 / #60a5fa
base-100      → #ffffff (light) / #000000 (dark) ← Pure neutral
base-200      → #f5f5f5 / #1a1a1a
base-300      → #e5e5e5 / #2a2a2a
```

## Example: Card

❌ **Bad:**

```tsx
<div className="bg-white p-6 shadow-[0_10px_24px_rgba(0,0,0,0.1)]">
```

✅ **Good:**

```tsx
<div className="bg-base-100 p-6 shadow-lg rounded-2xl">
```

## Example: Button

❌ **Bad:**

```tsx
<button className="bg-blue-600 text-white">
```

✅ **Good:**

```tsx
<Button variant="primary">
```

## Example: Form Error

❌ **Bad:**

```tsx
{
  error && <div className="bg-red-100 text-red-700">{error}</div>;
}
```

✅ **Good:**

```tsx
{
  error && <Alert variant="error">{error}</Alert>;
}
// OR
error && toastError(error);
```

## Example: Modal Animation

✅ **Good:**

```tsx
<div className="animate-scale-in animate-fade-in shadow-lg">
```

## CSS Variables Available

```css
--font-size-h1 through --font-size-micro
--spacing-xs through --spacing-3xl
--ease-apple (cubic-bezier for smooth animations)
--ease-spring (elastic animations)
--duration-quick/standard/emphasis
```

## Migration Checklist

- [ ] Replace `glass-*` → `bg-base-100 rounded-2xl shadow`
- [ ] Replace `bg-white` → `bg-base-100`
- [ ] Replace `text-black` → `text-base-content`
- [ ] Replace inline `rgba(...)` → `oklch(var(--bc) / opacity)`
- [ ] Replace `text-*-700` → `text-*` (use semantic tokens)
- [ ] Replace `hover:` with `hover:scale-[1.02] transition-all`

## Files to Know

- `tailwind.config.cjs` — DaisyUI theme + CSS variables
- `src/index.css` — Typography, spacing, animations
- `src/components/Button.tsx` — Apple-like transitions included
- `src/components/Modal.tsx` — Scale-in + fade-in animations

## Dark Mode Testing

```bash
npm run dev
# Toggle theme in UI (top-right) → verify light/dark looks identical
```

## Lint Rule: No Hard-coded Colors

ESLint now forbids hex/rgb colors in JSX `className`. Use DaisyUI tokens instead.

---

Last updated: Nov 5, 2025 | Apple-like Design System v1
