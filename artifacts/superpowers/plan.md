## Goal
Migrate all remaining legacy UI dependencies (Radix UI primitives, DaisyUI utility classes) to **HeroUI v3**.
Target components: Toasts, Dropdowns, Modals, and Buttons.

## Assumptions
- `@heroui/react` v3 is installed and configured (verified).
- `sonner` is available for Toasts (verified in package.json).
- The project aims to eliminate `@radix-ui/*` and `daisyui` dependencies entirely.

## Plan

### Phase 1: Toasts (Radix -> Sonner)
- [ ] **Audit**: `ToastContext.tsx` is a complex wrapper around Radix.
- [ ] **Refactor**: Replace `ToastContext.tsx` logic to wrapper `sonner`'s `toast` function, or simply export `sonner` directly if the API is compatible.
- [ ] **Update Consumers**: Refactor `CalendarClassificationPage.tsx` (direct Radix usage) to use the new Toast adapter/hook.
- [ ] **Verify**: Trigger toasts in the UI (e.g., Save actions).

### Phase 2: Dropdowns (Radix -> HeroUI)
- [ ] **Refactor Adapter**: Rewrite `apps/web/src/components/ui/DropdownMenu.tsx`.
    - Change imports from `@radix-ui/react-dropdown-menu` to `@heroui/react`.
    - Map `DropdownMenuContent` to HeroUI `DropdownMenu`.
    - Map `DropdownMenuItem` to HeroUI `DropdownItem`.
    - Map `DropdownMenuTrigger` to HeroUI `DropdownTrigger`.
    - **Crucial**: Ensure props compatibility (or update consumers if props differ significantly).
- [ ] **Verify**: Check User Menu and any other dropdowns.

### Phase 3: Modals (DaisyUI -> HeroUI)
- [ ] **Refactor Adapter**: Rewrite `apps/web/src/components/ui/Modal.tsx`.
    - Currently uses vanilla React Portal + DaisyUI CSS.
    - Replace implementation with HeroUI `<Modal>`, `<ModalContent>`, `<ModalHeader>`, `<ModalBody>`.
    - Maintain the existing `isOpen`, `onClose`, `title` API to avoid breaking consumers.
- [ ] **Verify**: Open "Delete Role", "Add User", etc.

### Phase 4: Buttons & General UI (DaisyUI -> HeroUI)
- [ ] **Refactor Buttons**: 
    - Search for keys `className="btn` and `className="... btn-"`.
    - Replace native HTML `<button>` with HeroUI `<Button>` component.
    - Map variants: `btn-primary` -> `color="primary"`, `btn-ghost` -> `variant="light"`, `btn-sm` -> `size="sm"`.
- [ ] **Refactor Alerts/Cards**:
    - Identify usages of `alert` or `card` classes and replace with HeroUI `<Alert>` or `<Card>`.
- [ ] **Verify**: Visual check of Dashboard, Settings, Employee forms.

### Phase 5: Cleanup
- [ ] **Uninstall**: `pnpm remove @radix-ui/react-dropdown-menu @radix-ui/react-toast daisyui`.
- [ ] **Config**: Remove `daisyui` from `tailwind.config.ts`.
- [ ] **Verify Build**: `pnpm build` and `pnpm type-check`.

## Risks & mitigations
- **Risk**: Prop mismatches between Radix headers and HeroUI components (e.g., `DropdownMenuContent` props).
    - **Mitigation**: The Adapter pattern in `components/ui/*.tsx` allows us to translate props centrally.
- **Risk**: Visual regression (DaisyUI styles look different from HeroUI).
    - **Mitigation**: Verification steps for each phase. Accept that HeroUI is the new design system standard.

## Rollback plan
- Revert via Git: `git checkout main` or revert specific commits.
