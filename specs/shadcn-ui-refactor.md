# Spec: Shadcn UI Component Refactor

## Problem Statement

WatchedSeerr's UI was constructed using raw HTML elements (`<input type="text">`, `<input type="checkbox">`, custom bordered metric `div`s, ad-hoc button groups) alongside inconsistent typography and layout wrappers. This breaks accessibility, keyboard navigation, theme consistency, and creates unnecessary custom CSS maintenance. The user needs the UI to strictly leverage accessible, unified `@/components/ui/*` primitives provided by shadcn across all tables, filters, cards, and modal dialogs.

## Solution

Refactor all client components, views, and dashboards to use shadcn UI components:
- Replace raw `<input type="checkbox">` in `columns.tsx` with `<Checkbox>`.
- Replace raw `<input type="text">` search bars with `<Input>`.
- Replace custom button-group filter bars with `<Tabs>` or `<Select>`.
- Replace metric containers and alert boxes with `<Card>`, `<CardHeader>`, `<CardTitle>`, `<CardContent>`, and `<Separator>`.
- Replace raw action icon buttons with `<Button variant="ghost">` wrapped in `<Tooltip>` / `<TooltipContent>`.
- Add `<DropdownMenu>` for bulk and per-item actions (e.g., delete from Sonarr/Radarr, toggle whitelist).
- Ensure `<TooltipProvider>` wraps the root layout in `app/layout.tsx`.

## User Stories

1. As an administrator, I want search inputs to use the shadcn `Input` component, so that search feels visually integrated and maintains focus ring consistency with the theme.
2. As an administrator, I want table row and header selection to use shadcn `Checkbox`, so that bulk selection supports keyboard interaction and accessible ARIA attributes.
3. As an administrator, I want filter toggles (status, media type) to use shadcn `Tabs` or `Select`, so that filtering is easy to navigate on both desktop and mobile.
4. As an administrator, I want metric summary widgets to use shadcn `Card` components, so that key statistics are clearly structured and visually uniform.
5. As an administrator, I want metric cards and queue headers to use shadcn `Separator`, so that layout demarcations remain standard.
6. As an administrator, I want audit item actions (purge, whitelist, inspect) to use shadcn `Button` and `Tooltip`, so that icon-only buttons have descriptive hover labels.
7. As an administrator, I want table row action menus to use shadcn `DropdownMenu`, so that secondary operations (e.g. Radarr/Sonarr unmonitor vs file delete) are organized without cluttering table cells.
8. As an administrator, I want the matrix overview to use shadcn `Card` and `Badge` components, so that user playback states are legible and consistent with the audit queue.
9. As an administrator, I want delete confirmations to use shadcn `Dialog`, so that accidental media removals are prevented with clear modal actions.
10. As an administrator, I want the root application to provide `TooltipProvider`, so that all tooltips across sheets and tables function without hydration mismatches.

## Implementation Decisions

### 1. Root Layout Provider
Wrap application children in `TooltipProvider` within `app/layout.tsx`:
```tsx
import { TooltipProvider } from "@/components/ui/tooltip"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### 2. Table Column Checkboxes (`components/audit-table/columns.tsx`)
Replace raw HTML `<input type="checkbox">` with shadcn `Checkbox`:
- `header`: `<Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(val) => table.toggleAllPageRowsSelected(!!val)} aria-label="Select all" />`
- `cell`: `<Checkbox checked={row.getIsSelected()} onCheckedChange={(val) => row.toggleSelected(!!val)} aria-label="Select row" />`

### 3. Data Table Controls (`components/audit-table/data-table.tsx`)
- Replace search `<input>` with `<Input className="h-8 w-60" placeholder="Search title..." />`.
- Replace raw button groups with `<Tabs>` for media type (`all`, `movie`, `tv`) and status (`all`, `safe`, `conflict`, `ghost`).
- Wrap quick actions (whitelist toggle, delete) in `<Tooltip>` and `<Button variant="outline" size="sm">`.
- Use `<DropdownMenu>` for row-level actions or bulk actions.

### 4. Metric Dashboard Cards (`app/page.tsx` & `app/matrix/page.tsx`)
- Replace metric border `div`s with `<Card>`, `<CardHeader>`, `<CardTitle>`, and `<CardContent>`.
- Use `<Separator>` between metric cards and table filters.

## Testing Decisions

- **Good Test Standard**: Test external behavior and accessibility contracts (e.g., checkbox state change triggers TanStack table row selection; clicking filter tab filters table items). Avoid testing internal React styles or Base UI state internals.
- **Modules Tested**: `components/audit-table/data-table.tsx` and `components/audit-table/columns.tsx` behavior.
- **Seam**: Client component render with mock `AuditMediaItem[]` data.
- **Prior Art**: `tests/validation.test.ts` and `tests/arr-clients.test.ts`.

## Out of Scope

- Introducing new backend database fields or modifying Drizzle schema.
- Adding pagination backends (server-side pagination remains out of scope; client-side TanStack is preserved).
- Modifying Radarr/Sonarr purge API endpoints.

## Further Notes

- UI theme relies on `@base-ui/react` primitives configured under `base-lyra` preset in `components.json`.
- All newly added components (`components/ui/*`) are verified and match the existing Radix/Base-UI configuration.
