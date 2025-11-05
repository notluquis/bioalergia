# Design System Quick Reference

**Cheat sheet for migrating pages to the Apple-grade design system**

---

## Spacing Migration

### ❌ Before (arbitrary values)

```tsx
<div className="p-7 gap-5 space-y-7">
  <section className="px-6 py-3">
```

### ✅ After (tokens only)

```tsx
<div className="p-6 gap-6 space-y-6">  {/* or p-8 gap-4 space-y-8 */}
  <section className="px-6 py-4">
```

**Token Scale:** xs(4px) → sm(8px) → md(16px) → lg(24px) → xl(32px) → 2xl(48px) → 3xl(64px)

---

## Component Replacement

### ❌ Before (ad-hoc structure)

```tsx
<section className="space-y-6">
  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
    <div className="space-y-2">
      <h1 className="text-2xl font-bold text-primary">Title</h1>
      <p className="text-sm text-base-content/70">Description</p>
    </div>
    <div className="flex gap-4">
      <Button variant="primary">Action</Button>
    </div>
  </div>

  <div className="bg-base-100 p-6 rounded-2xl">Content here</div>
</section>
```

### ✅ After (using primitives)

```tsx
import { PageHeader, Card, Section } from "@/components/Layout";

<Section>
  <PageHeader title="Title" description="Description" actions={<Button variant="primary">Action</Button>} />

  <Card padding="default">Content here</Card>
</Section>;
```

---

## Layout Patterns

### List + Detail (Master-Detail)

```tsx
import { Inline, Stack, Card } from "@/components/Layout";

<Inline spacing="lg" className="items-start">
  {/* Sidebar list */}
  <div className="w-72 shrink-0">
    <Stack spacing="sm">
      {items.map((item) => (
        <Card key={item.id}>{item.name}</Card>
      ))}
    </Stack>
  </div>

  {/* Main content */}
  <div className="flex-1">
    <Stack spacing="lg">
      <Card padding="spacious">Detail view</Card>
    </Stack>
  </div>
</Inline>;
```

### Card Grid

```tsx
import { Grid, Card } from "@/components/Layout";

<Grid gap="lg" cols={1} colsMd={2} colsLg={3}>
  {items.map((item) => (
    <Card key={item.id} padding="default" shadow="md">
      {item.content}
    </Card>
  ))}
</Grid>;
```

### Form Layout

```tsx
import { Stack, Inline, Card } from "@/components/Layout";

<Card padding="default">
  <Stack spacing="lg">
    <Input label="Name" />
    <Input label="Email" type="email" />

    <Inline spacing="md" justify="end">
      <Button variant="secondary">Cancel</Button>
      <Button variant="primary">Save</Button>
    </Inline>
  </Stack>
</Card>;
```

---

## Touch Target Compliance (44×44px minimum)

### ❌ Before (too small)

```tsx
<button className="h-8 px-3">Click</button>  {/* 32px height */}
<input className="h-9" />  {/* 36px height */}
```

### ✅ After (compliant)

```tsx
<Button size="md">Click</Button>  {/* 44px height */}
<Input className="h-11" />  {/* 44px height */}
```

**Button heights:**

- `size="sm"` → 40px (use sparingly)
- `size="md"` → 44px ✓ **default**
- `size="lg"` → 48px

---

## Typography with Line Heights

### ❌ Before (missing line-height)

```tsx
<h1 className="text-2xl font-bold">Title</h1>
<p className="text-sm">Description</p>
```

### ✅ After (explicit line-height)

```tsx
<h1 className="text-2xl font-bold leading-8">Title</h1>
<p className="text-sm leading-6">Description</p>
```

**Scale:**

- `text-xs leading-5` (12px / 20px)
- `text-sm leading-6` (14px / 24px)
- `text-base leading-6` (16px / 24px)
- `text-lg leading-7` (18px / 28px)
- `text-xl leading-7` (20px / 28px)
- `text-2xl leading-8` (24px / 32px)

---

## Color Semantics (DaisyUI only)

### ❌ Before (hardcoded)

```tsx
<div className="bg-white text-gray-600 border-gray-200">
<div className="bg-[#ecf4fc] text-[#0e64b7]">
```

### ✅ After (semantic tokens)

```tsx
<div className="bg-base-100 text-base-content border-base-300">
<div className="bg-base-100 text-primary">
```

**Token Reference:**

- Surfaces: `bg-base-100`, `bg-base-200`, `bg-base-300`
- Text: `text-base-content`, `text-base-content/70` (opacity)
- Brand: `text-primary`, `bg-primary`, `text-secondary`, `bg-secondary`
- States: `bg-success`, `bg-error`, `bg-warning`, `bg-info`

---

## Icon Usage

### ❌ Before (direct import)

```tsx
import { Home, Settings } from "lucide-react";
```

### ✅ After (from whitelist)

```tsx
import { Home, Settings } from "@/design-system/icons";

// With consistent sizing
<Home size={20} />  {/* default */}
<Settings size={16} />  {/* small */}
<Menu size={24} />  {/* large */}
```

---

## Responsive Breakpoints

```tsx
{/* Mobile-first approach */}
<div className="
  p-4                    {/* mobile: 16px */}
  sm:p-6                 {/* ≥640px: 24px */}
  lg:p-8                 {/* ≥1024px: 32px */}
">

{/* Flex direction */}
<div className="
  flex flex-col          {/* mobile: vertical */}
  lg:flex-row            {/* ≥1024px: horizontal */}
  gap-4 lg:gap-6
">

{/* Grid columns */}
<Grid
  cols={1}               {/* mobile: 1 col */}
  colsMd={2}             {/* ≥768px: 2 cols */}
  colsLg={3}             {/* ≥1024px: 3 cols */}
  gap="lg"
>
```

---

## Common Patterns

### Page Structure

```tsx
import { PageHeader, Section, Card, Stack } from "@/components/Layout";

export default function MyPage() {
  return (
    <Stack spacing="lg">
      <PageHeader title="Page Title" description="Optional description" actions={<Button>Action</Button>} />

      <Section title="Section Title" description="Section description">
        <Card padding="default">Content</Card>
      </Section>
    </Stack>
  );
}
```

### Modal/Dialog Content

```tsx
<Card padding="spacious">
  <Stack spacing="lg">
    <div className="space-y-2">
      <h2 className="text-xl font-semibold leading-7">Dialog Title</h2>
      <p className="text-sm text-base-content/70 leading-6">Description</p>
    </div>

    {/* Form fields */}
    <Stack spacing="md">
      <Input label="Field 1" />
      <Input label="Field 2" />
    </Stack>

    {/* Actions */}
    <Inline spacing="md" justify="end">
      <Button variant="secondary">Cancel</Button>
      <Button variant="primary">Save</Button>
    </Inline>
  </Stack>
</Card>
```

### Loading/Empty States

```tsx
<Card padding="spacious">
  <Stack spacing="md" align="center">
    {loading ? (
      <>
        <div className="loading loading-spinner loading-lg text-primary" />
        <p className="text-sm text-base-content/60">Loading...</p>
      </>
    ) : (
      <>
        <p className="text-base text-base-content/60">No data available</p>
        <Button variant="primary" size="sm">
          Create New
        </Button>
      </>
    )}
  </Stack>
</Card>
```

---

## Migration Checklist (Per Page)

When refactoring a page, check off:

- [ ] Replace arbitrary spacing (`p-7`, `gap-5`) with tokens (`p-6`, `gap-6`)
- [ ] Use `<PageHeader>` for page title + actions
- [ ] Replace `<div className="bg-base-100 p-6">` with `<Card padding="default">`
- [ ] Use `<Stack>` / `<Inline>` instead of `space-y-*` / `flex gap-*`
- [ ] Use `<Section>` for semantic grouping with titles
- [ ] Ensure all buttons are `size="md"` (44px) unless exception
- [ ] Add explicit `leading-*` to all `text-*` classes
- [ ] Replace hardcoded colors with semantic tokens
- [ ] Import icons from `@/design-system/icons`
- [ ] Test responsive breakpoints (390px, 768px, 1920px)
- [ ] Verify dark mode (`data-theme="bioalergia-dark"`)
- [ ] Screenshot before/after for PR documentation

---

**Pro tip:** Start with `Counterparts.tsx` as the reference implementation, then replicate pattern to other pages.
