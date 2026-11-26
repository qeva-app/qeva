# Phase 1: Foundation — Design System & Component Primitives

**Goal:** Install shadcn/ui, establish the QEVA design token system (Indigo/Violet brand), enable dark mode, and create all base UI primitives so that Phases 2-6 can build on a solid foundation.

**Architecture:** shadcn/ui components (Radix primitives + Tailwind CSS) with CSS custom properties for theming. Dark mode via Tailwind `darkMode: 'class'` + a ThemeProvider. TanStack Query for data fetching. React Hook Form + Zod for forms. Sonner replaces react-hot-toast.

**Tech Stack:** shadcn/ui, Radix UI, TanStack Query, React Hook Form, @hookform/resolvers, Sonner, tailwindcss-animate, class-variance-authority, clsx

---

## File Map

### New Files
- `src/lib/utils.ts` — `cn()` utility (shadcn requirement)
- `src/components/ui/button.tsx` — Button component
- `src/components/ui/input.tsx` — Input component
- `src/components/ui/card.tsx` — Card component
- `src/components/ui/dialog.tsx` — Dialog/Modal component
- `src/components/ui/alert-dialog.tsx` — Confirmation dialog
- `src/components/ui/select.tsx` — Select dropdown
- `src/components/ui/dropdown-menu.tsx` — Dropdown menu
- `src/components/ui/tooltip.tsx` — Tooltip
- `src/components/ui/skeleton.tsx` — Skeleton loader
- `src/components/ui/badge.tsx` — Badge component
- `src/components/ui/tabs.tsx` — Tabs component
- `src/components/ui/separator.tsx` — Separator/divider
- `src/components/ui/label.tsx` — Form label
- `src/components/ui/textarea.tsx` — Textarea
- `src/components/ui/form.tsx` — React Hook Form integration
- `src/components/ui/sonner.tsx` — Sonner toast wrapper
- `src/components/ui/sheet.tsx` — Sheet/drawer (for mobile sidebar)
- `src/components/ui/scroll-area.tsx` — Custom scroll area
- `src/components/ui/avatar.tsx` — Avatar component
- `src/components/ui/switch.tsx` — Toggle switch
- `src/components/ui/progress.tsx` — Progress bar
- `src/components/ui/command.tsx` — Command palette (cmdk)
- `src/components/ThemeProvider.tsx` — Dark mode theme provider
- `src/components/ThemeToggle.tsx` — Dark/light mode toggle button
- `src/hooks/use-theme.ts` — Theme hook
- `components.json` — shadcn/ui configuration

### Modified Files
- `tailwind.config.js` — Add darkMode, CSS variable colors, tailwindcss-animate
- `src/app/globals.css` — Replace component layer with CSS custom properties
- `src/app/layout.tsx` — Add dark mode class support
- `src/app/providers.tsx` — Add ThemeProvider, QueryClientProvider, replace Toaster with Sonner
- `package.json` — New dependencies
- `postcss.config.js` — No changes needed (already correct)

---

## Tasks

### Task 1: Install Dependencies

- [ ] **Step 1: Install shadcn/ui dependencies and supporting libraries**

```bash
npm install class-variance-authority clsx tailwind-merge tailwindcss-animate
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-tooltip @radix-ui/react-tabs @radix-ui/react-separator @radix-ui/react-label @radix-ui/react-switch @radix-ui/react-progress @radix-ui/react-scroll-area @radix-ui/react-avatar @radix-ui/react-alert-dialog @radix-ui/react-slot
npm install @tanstack/react-query react-hook-form @hookform/resolvers
npm install sonner cmdk next-themes
```

- [ ] **Step 2: Verify installation**

Run: `npm ls class-variance-authority @radix-ui/react-dialog @tanstack/react-query sonner cmdk next-themes`
Expected: All packages listed without errors

- [ ] **Step 3: Create shadcn components.json config**

Create `components.json` at project root.

### Task 2: Design Token System — Tailwind Config

- [ ] **Step 1: Update tailwind.config.js**

Replace the current config with CSS custom property based theming, darkMode: 'class', and the QEVA Indigo/Violet brand tokens.

- [ ] **Step 2: Verify Tailwind compiles**

Run: `npx tailwindcss --content './src/**/*.tsx' --output /dev/null`
Expected: No errors

### Task 3: CSS Custom Properties — globals.css

- [ ] **Step 1: Replace globals.css**

Replace the current `@layer components` CSS classes with CSS custom properties for light/dark themes. Keep backward-compatible `.btn`, `.card`, `.input` classes that now use the CSS variables, so existing components don't break immediately.

### Task 4: Dark Mode Infrastructure

- [ ] **Step 1: Create ThemeProvider**

Wrap `next-themes` ThemeProvider for dark mode support.

- [ ] **Step 2: Create ThemeToggle**

Button component to toggle between light/dark/system modes.

- [ ] **Step 3: Update root layout.tsx**

Add `suppressHydrationWarning` and dark mode class support to `<html>`.

- [ ] **Step 4: Update providers.tsx**

Add ThemeProvider, QueryClientProvider, replace react-hot-toast Toaster with Sonner.

### Task 5: Utility Functions

- [ ] **Step 1: Create cn() utility**

shadcn/ui's class merging utility at `src/lib/utils.ts`.

### Task 6: Base UI Primitives (shadcn/ui components)

- [ ] **Step 1: Create Button component** — `src/components/ui/button.tsx`
- [ ] **Step 2: Create Input component** — `src/components/ui/input.tsx`
- [ ] **Step 3: Create Label component** — `src/components/ui/label.tsx`
- [ ] **Step 4: Create Textarea component** — `src/components/ui/textarea.tsx`
- [ ] **Step 5: Create Card component** — `src/components/ui/card.tsx`
- [ ] **Step 6: Create Badge component** — `src/components/ui/badge.tsx`
- [ ] **Step 7: Create Separator component** — `src/components/ui/separator.tsx`
- [ ] **Step 8: Create Avatar component** — `src/components/ui/avatar.tsx`
- [ ] **Step 9: Create Switch component** — `src/components/ui/switch.tsx`
- [ ] **Step 10: Create Progress component** — `src/components/ui/progress.tsx`
- [ ] **Step 11: Create Skeleton component** — `src/components/ui/skeleton.tsx`
- [ ] **Step 12: Create Tooltip component** — `src/components/ui/tooltip.tsx`
- [ ] **Step 13: Create Dialog component** — `src/components/ui/dialog.tsx`
- [ ] **Step 14: Create AlertDialog component** — `src/components/ui/alert-dialog.tsx`
- [ ] **Step 15: Create Select component** — `src/components/ui/select.tsx`
- [ ] **Step 16: Create DropdownMenu component** — `src/components/ui/dropdown-menu.tsx`
- [ ] **Step 17: Create Tabs component** — `src/components/ui/tabs.tsx`
- [ ] **Step 18: Create Sheet component** — `src/components/ui/sheet.tsx`
- [ ] **Step 19: Create ScrollArea component** — `src/components/ui/scroll-area.tsx`
- [ ] **Step 20: Create Sonner wrapper** — `src/components/ui/sonner.tsx`
- [ ] **Step 21: Create Form component** — `src/components/ui/form.tsx`
- [ ] **Step 22: Create Command component** — `src/components/ui/command.tsx`

### Task 7: Verification

- [ ] **Step 1: Build check**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Dev server check**

Run: `npm run dev`
Expected: App loads, existing pages still render, dark mode toggle works

---

## Self-Review

- **Spec coverage:** All Phase 1 requirements covered (shadcn/ui install, design tokens, dark mode, 22 primitives, TanStack Query, React Hook Form, Sonner)
- **Placeholder scan:** No TBD/TODO items — all tasks have concrete deliverables
- **Type consistency:** All components follow shadcn/ui patterns with proper TypeScript typing
- **Backward compatibility:** Old `.btn`, `.card`, `.input` CSS classes are preserved in globals.css so existing components don't break
