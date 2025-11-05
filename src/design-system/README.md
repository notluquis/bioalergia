# Bioalergia Finanzas - Design System

Apple-grade design principles for consistency, accessibility, and mobile-first responsive design.

## Core Principles

### 1. **Spacing Consistency**

- Use ONLY tokens from `tokens.ts` - no arbitrary values
- Follow 4px base grid: `xs(4) → sm(8) → md(16) → lg(24) → xl(32) → 2xl(48) → 3xl(64)`
- Examples:
  ```tsx
  ✅ <div className="p-6 gap-4">
  ❌ <div className="p-7 gap-5">
  ```

### 2. **Touch Target Compliance**

- Minimum 44×44px for all interactive elements (iOS HIG)
- Button `md` size = 44px height (default)
- Input `md` size = 44px height (default)
- Links/icons need padding to reach 44×44px

### 3. **Typography Scale**

- Always pair size with line-height:
  ```tsx
  ✅ <h1 className="text-2xl leading-8">
  ❌ <h1 className="text-2xl">
  ```
- Use semantic sizes: `text-xs` through `text-4xl`

### 4. **Component Reusability**

- Use layout primitives from `src/components/Layout/`:
  - `<Card>` - standardized container
  - `<PageHeader>` - page titles with actions
  - `<Stack>` / `<Inline>` - flex containers with token spacing
  - `<Grid>` - responsive grid layouts
  - `<Section>` - semantic sections

### 5. **Color Semantics**

- Use DaisyUI tokens ONLY:
  - `bg-base-100`, `bg-base-200`, `bg-base-300` (surfaces)
  - `text-base-content` (primary text)
  - `text-primary`, `text-secondary` (brand colors)
  - `bg-primary`, `bg-secondary` (buttons, highlights)
- NO hardcoded colors: `#fff`, `rgb()`, `rgba()`

### 6. **Responsive Design**

- Mobile-first approach
- Breakpoints: `sm(640) → md(768) → lg(1024) → xl(1280) → 2xl(1536)`
- Test on: iPhone 14 Pro (390×844), iPad Pro (1024×1366), Desktop (1920×1080)

### 7. **Animation**

- Use defined durations: `fast(150ms)`, `normal(250ms)`, `slow(350ms)`
- Prefer `transition-all duration-250` over arbitrary values

## Layout Patterns

### List + Detail Split (Master-Detail)

```tsx
<section className="flex flex-col gap-6 xl:flex-row">
  <div className="xl:w-72 xl:shrink-0">{/* Sidebar list */}</div>
  <div className="flex-1 space-y-6">{/* Main content */}</div>
</section>
```

### Card Grid

```tsx
<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
  <Card padding="default">Content</Card>
</div>
```

### Form Layout

```tsx
<div className="space-y-6">
  <Input label="Name" />
  <Input label="Email" />
  <div className="flex gap-4 justify-end">
    <Button variant="secondary">Cancel</Button>
    <Button variant="primary">Save</Button>
  </div>
</div>
```

## iOS-Style Bottom Navigation (Mobile)

- Hidden on `lg:` breakpoint and above (desktop uses sidebar)
- Fixed bottom position with safe-area-inset support
- Max 5 primary actions
- Active state shows primary color + bold text
- Icons from whitelisted set (see `icons.md`)

## Accessibility

- Semantic HTML (`<section>`, `<nav>`, `<main>`, `<article>`)
- ARIA labels on icon-only buttons
- Keyboard navigation support (focus-visible states)
- Color contrast: WCAG AA minimum (4.5:1 for text)
- Form validation shown inline on blur

## Z-Index Stack Order

```
base: 0 (default)
dropdown: 10
sticky: 20
overlay: 30
modal: 40
popover: 50
toast: 60
```

## Migration Checklist

When refactoring a page:

1. ✅ Replace arbitrary spacing (`p-7`) with tokens (`p-6`, `p-8`)
2. ✅ Use layout primitives (`<Card>`, `<Stack>`, `<PageHeader>`)
3. ✅ Ensure touch targets ≥44px (`Button size="md"`, `Input className="h-11"`)
4. ✅ Typography has line-height (`text-xl leading-7`)
5. ✅ Only DaisyUI color tokens (no `bg-white`, `text-gray-500`)
6. ✅ Icons from whitelist only
7. ✅ Responsive breakpoints tested (mobile/tablet/desktop)
8. ✅ Dark mode verified (`data-theme="bioalergia-dark"`)

## Resources

- Tokens: `src/design-system/tokens.ts`
- Components: `src/components/Layout/`
- Icons: `src/design-system/icons.md`
- Tailwind Config: `tailwind.config.cjs`
- DaisyUI Docs: https://daisyui.com/components/
