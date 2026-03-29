# FlowSuite Monorepo Platform — Design Spec

## Overview

Transform TheTools from a single Next.js app into FlowSuite — a monorepo platform housing multiple hydraulic engineering tools under one domain. Route-based modules share a common design system, calculation engine, type definitions, and localStorage data layer.

**Product name:** FlowSuite
**Tagline:** Hydraulic engineering tools for bridge waterway assessment
**Domain structure:** `flowsuite.app/` (landing), `flowsuite.app/blc` (BLC), `flowsuite.app/hydro` (future), `flowsuite.app/report` (future)

## Constraints

- No backend, no accounts, no auth
- Data shared via localStorage (same origin)
- Single Vercel deployment
- pnpm workspaces + Turborepo
- All existing BLC functionality must work after migration

---

## 1. Monorepo Structure

```
flowsuite/
├── apps/
│   └── web/                          # Single Next.js 16 app
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx        # Root layout (dark theme, fonts)
│       │   │   ├── page.tsx          # Landing launcher
│       │   │   ├── blc/             # BLC route group
│       │   │   │   ├── layout.tsx   # BLC-specific layout
│       │   │   │   ├── page.tsx     # BLC main page
│       │   │   │   ├── components/  # All BLC components
│       │   │   │   ├── store/       # BLC Zustand store
│       │   │   │   ├── config/      # Regulatory checklists
│       │   │   │   └── lib/         # BLC-specific utils (hecras-parser, ai prompts)
│       │   │   ├── hydro/          # Hydrology (future)
│       │   │   └── report/         # Report Builder (future)
│       │   └── api/                 # API routes (shared)
│       │       ├── ai-chat/
│       │       ├── ai-narrative/
│       │       └── ai-summary/
│       ├── public/                  # Static assets (bridge videos, textures)
│       ├── next.config.ts
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── ui/                          # @flowsuite/ui — shared design system
│   │   ├── src/
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── ... (all current ui/ components)
│   │   │   └── index.ts            # Re-export everything
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── engine/                      # @flowsuite/engine — pure calculations
│   │   ├── src/
│   │   │   ├── types.ts            # All type definitions
│   │   │   ├── index.ts            # runAllMethods, runWithSensitivity
│   │   │   ├── hydraulics.ts
│   │   │   ├── geometry.ts
│   │   │   ├── bridge-geometry.ts
│   │   │   ├── flow-regime.ts
│   │   │   ├── iteration.ts
│   │   │   ├── pressure-flow.ts
│   │   │   ├── overtopping-flow.ts
│   │   │   ├── freeboard.ts
│   │   │   ├── tuflow-flc.ts
│   │   │   ├── simulation-profile.ts
│   │   │   ├── method-suitability.ts
│   │   │   ├── optimizer.ts
│   │   │   ├── deck-profile.ts
│   │   │   ├── methods/            # Energy, Momentum, Yarnell, WSPRO
│   │   │   ├── scour/             # Pier scour, contraction scour
│   │   │   ├── hydrology/         # Rational method, Tc
│   │   │   ├── adequacy/          # Decision engine
│   │   │   ├── reach/             # Multi-bridge solver
│   │   │   └── import/            # CSV parser
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── data/                        # @flowsuite/data — shared utilities
│       ├── src/
│       │   ├── units.ts            # Unit conversion (metric/imperial)
│       │   ├── json-io.ts          # Project serialization
│       │   ├── validation.ts       # Input validation
│       │   ├── test-bridges.ts     # Test data
│       │   ├── constants.ts        # Shared constants
│       │   ├── storage.ts          # localStorage utilities with flowsuite: namespace
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json                     # Root workspace config
└── README.md
```

## 2. Package Details

### @flowsuite/ui
- All files from current `app/src/components/ui/`
- Exports every component from `index.ts`
- Peer dependencies: React 19, Tailwind CSS 4, class-variance-authority, clsx, tailwind-merge
- Includes the `cn()` utility

### @flowsuite/engine
- All files from current `app/src/engine/`
- types.ts stays here (not a separate types package — keeps it simple)
- Zero UI dependencies, zero React dependencies
- Peer dependency: none (pure TypeScript)
- Tests move to `packages/engine/__tests__/`

### @flowsuite/data
- `units.ts` — unit conversion and labels
- `json-io.ts` — project serialization/deserialization
- `validation.ts` — input validation rules
- `test-bridges.ts` — test bridge data
- `constants.ts` — shared constants
- `storage.ts` — NEW: localStorage utilities
  ```typescript
  const NS = 'flowsuite';
  export function getStorage<T>(key: string): T | null
  export function setStorage<T>(key: string, value: T): void
  export function removeStorage(key: string): void
  export function listStorageKeys(prefix: string): string[]
  ```
- Peer dependency: none (pure TypeScript)

## 3. Landing Page

Route: `/` (apps/web/src/app/page.tsx)

Minimal launcher. Dark theme matching BLC.

**Layout:**
- Centered content, max-width ~800px
- FlowSuite text logo at top (styled with the same font as BLC header)
- Subtitle: "Hydraulic engineering tools for bridge waterway assessment"
- Module cards below in a responsive grid

**Module cards (at launch):**
| Module | Icon | Description | Route | Status |
|--------|------|-------------|-------|--------|
| Bridge Loss Calculator | Waves | Bridge hydraulics, scour, adequacy, QA/QC | /blc | Available |
| Hydrology | Droplets | Catchment analysis, ARR2019, design floods | /hydro | Coming Soon |
| Report Builder | FileText | Cross-module document generation | /report | Coming Soon |

Cards use the same Card component from @flowsuite/ui. Available cards are clickable links. Coming Soon cards are muted/disabled.

## 4. BLC Migration

### Files that move to @flowsuite/engine:
- `app/src/engine/*` (all files and subdirectories)

### Files that move to @flowsuite/ui:
- `app/src/components/ui/*` (all UI primitives)
- `app/src/lib/utils.ts` (cn utility)

### Files that move to @flowsuite/data:
- `app/src/lib/units.ts`
- `app/src/lib/json-io.ts`
- `app/src/lib/validation.ts`
- `app/src/lib/test-bridges.ts`
- `app/src/lib/constants.ts`

### Files that stay in apps/web/src/app/blc/:
- All `components/` subdirectories (input, analysis, assessment, hydrology, simulation, report, results, summary, data, import, ai-chat, what-if)
- `store/project-store.ts`
- `config/regulatory-checklists.ts`
- `lib/hecras-parser.ts`
- `lib/api/*` (AI prompt templates)
- `components/main-tabs.tsx` (renamed to the BLC page component)
- `components/cross-section-chart.tsx`
- `components/hazard-overlay.tsx`
- `components/pdf-report.tsx`
- `components/pdf-charts.tsx`

### API routes stay at app level:
- `apps/web/src/app/api/ai-chat/route.ts`
- `apps/web/src/app/api/ai-narrative/route.ts`
- `apps/web/src/app/api/ai-summary/route.ts`

### Import path changes:
- `@/engine/...` → `@flowsuite/engine`
- `@/components/ui/...` → `@flowsuite/ui`
- `@/lib/units` → `@flowsuite/data`
- `@/lib/json-io` → `@flowsuite/data`
- `@/lib/validation` → `@flowsuite/data`
- `@/lib/test-bridges` → `@flowsuite/data`
- `@/lib/constants` → `@flowsuite/data`
- BLC-internal imports use relative paths or `@blc/...` alias

### Public assets:
- `public/bridges/` (videos) → `apps/web/public/bridges/`
- `public/textures/` → `apps/web/public/textures/`

## 5. Deployment

- Single Vercel project pointing to `apps/web`
- Build: `pnpm turbo build --filter=web`
- Root directory in Vercel: `apps/web`
- Install command: `pnpm install`
- Framework: Next.js (auto-detected)

### turbo.json
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### pnpm-workspace.yaml
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

## 6. Migration Order

1. Initialize monorepo scaffold (root package.json, turbo.json, pnpm-workspace.yaml)
2. Create packages/engine — move engine files, set up package.json and tsconfig
3. Create packages/ui — move UI components, set up package.json and tsconfig
4. Create packages/data — move utility files, add storage.ts, set up package.json and tsconfig
5. Create apps/web — new Next.js app with root layout and landing page
6. Move BLC into apps/web/src/app/blc/ — components, store, config, lib
7. Move API routes into apps/web/src/app/api/
8. Move public assets into apps/web/public/
9. Update ALL imports across BLC to use @flowsuite/* packages
10. Move tests to appropriate packages
11. Verify: pnpm build, pnpm test
12. Remove old app/ directory (replaced by apps/web)
