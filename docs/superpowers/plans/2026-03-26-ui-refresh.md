# UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the Bridge Loss Calculator UI to ShadCN-level quality with a distinctive slate-blue dark theme, proper Card containers, Table components, Lucide icons, and consistent typography.

**Architecture:** Pure UI reskin — no changes to engine, store, types, or validation. Every component file gets updated in-place. Theme colors change in globals.css, then each component is upgraded to use Card wrappers, proper Table components, Lucide icons, and consistent spacing/typography.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, ShadCN (base-ui), Lucide React, Recharts, Zustand

---

### Task 1: Update Color Palette & Theme

**Files:**
- Modify: `app/src/app/globals.css`

- [ ] **Step 1: Update the dark theme CSS custom properties**

Replace the `.dark` block in `globals.css` with the new slate-blue palette:

```css
.dark {
  --background: oklch(0.13 0.01 230);
  --foreground: oklch(0.95 0 0);
  --card: oklch(0.17 0.01 230);
  --card-foreground: oklch(0.95 0 0);
  --popover: oklch(0.17 0.01 230);
  --popover-foreground: oklch(0.95 0 0);
  --primary: oklch(0.55 0.12 230);
  --primary-foreground: oklch(0.98 0 0);
  --secondary: oklch(0.22 0.02 230);
  --secondary-foreground: oklch(0.95 0 0);
  --muted: oklch(0.22 0.02 230);
  --muted-foreground: oklch(0.60 0.01 260);
  --accent: oklch(0.22 0.02 230);
  --accent-foreground: oklch(0.95 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(0.26 0.02 230);
  --input: oklch(0.26 0.02 230);
  --ring: oklch(0.55 0.12 230);
  --chart-1: oklch(0.55 0.12 230);
  --chart-2: oklch(0.65 0.15 160);
  --chart-3: oklch(0.70 0.15 55);
  --chart-4: oklch(0.55 0.15 300);
  --chart-5: oklch(0.65 0.18 25);
  --sidebar: oklch(0.15 0.01 230);
  --sidebar-foreground: oklch(0.95 0 0);
  --sidebar-primary: oklch(0.55 0.12 230);
  --sidebar-primary-foreground: oklch(0.98 0 0);
  --sidebar-accent: oklch(0.22 0.02 230);
  --sidebar-accent-foreground: oklch(0.95 0 0);
  --sidebar-border: oklch(0.26 0.02 230);
  --sidebar-ring: oklch(0.55 0.12 230);
}
```

- [ ] **Step 2: Verify the app renders with new colors**

Run: `cd app && npm run dev`
Open browser, check that the dark theme has a subtle blue undertone, not pure gray.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/globals.css
git commit -m "style: update dark theme to slate-blue palette"
```

---

### Task 2: Top Bar Polish

**Files:**
- Modify: `app/src/components/top-bar.tsx`

- [ ] **Step 1: Rewrite top-bar.tsx with icons, frosted header, and accent title**

```tsx
'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/project-store';
import { Waves, Upload, Download } from 'lucide-react';

export function TopBar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportProject = useProjectStore((s) => s.exportProject);
  const importProject = useProjectStore((s) => s.importProject);

  function handleExport() {
    const json = exportProject();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bridge-loss-project.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importProject(reader.result as string);
      } catch (err) {
        alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b border-border/50 backdrop-blur-sm bg-background/80">
      <div className="flex items-center gap-2.5">
        <Waves className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold text-primary">Bridge Loss Calculator</h1>
      </div>
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1.5" />
          Import
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1.5" />
          Export
        </Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify in browser**

Check: frosted header visible when scrolling, accent-colored title + wave icon, icon buttons.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/top-bar.tsx
git commit -m "style: polish top bar with icons and frosted header"
```

---

### Task 3: Main Tabs with Icons

**Files:**
- Modify: `app/src/components/main-tabs.tsx`

- [ ] **Step 1: Rewrite main-tabs.tsx with Lucide icons and renamed label**

```tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CrossSectionForm } from '@/components/input/cross-section-form';
import { BridgeGeometryForm } from '@/components/input/bridge-geometry-form';
import { FlowProfilesForm } from '@/components/input/flow-profiles-form';
import { CoefficientsForm } from '@/components/input/coefficients-form';
import { ActionButtons } from '@/components/input/action-buttons';
import { MethodTabs } from '@/components/results/method-tabs';
import { ComparisonTables } from '@/components/summary/comparison-tables';
import { RegimeMatrix } from '@/components/summary/regime-matrix';
import { SummaryCharts } from '@/components/summary/charts';
import { Settings2, FlaskConical, BarChart3 } from 'lucide-react';

export function MainTabs() {
  return (
    <Tabs defaultValue="input" className="flex-1 flex flex-col">
      <TabsList className="mx-6 mt-4 w-fit">
        <TabsTrigger value="input">
          <Settings2 className="h-4 w-4 mr-1.5" />
          Input
        </TabsTrigger>
        <TabsTrigger value="results">
          <FlaskConical className="h-4 w-4 mr-1.5" />
          Method Results
        </TabsTrigger>
        <TabsTrigger value="summary">
          <BarChart3 className="h-4 w-4 mr-1.5" />
          Summary
        </TabsTrigger>
      </TabsList>

      <TabsContent value="input" className="flex-1 px-6 py-5">
        <Tabs defaultValue="cross-section">
          <TabsList className="w-fit mb-4">
            <TabsTrigger value="cross-section">Cross-Section</TabsTrigger>
            <TabsTrigger value="bridge">Bridge Geometry</TabsTrigger>
            <TabsTrigger value="profiles">Flow Profiles</TabsTrigger>
            <TabsTrigger value="coefficients">Coefficients</TabsTrigger>
          </TabsList>
          <TabsContent value="cross-section"><CrossSectionForm /></TabsContent>
          <TabsContent value="bridge"><BridgeGeometryForm /></TabsContent>
          <TabsContent value="profiles"><FlowProfilesForm /></TabsContent>
          <TabsContent value="coefficients"><CoefficientsForm /></TabsContent>
        </Tabs>
        <ActionButtons />
      </TabsContent>

      <TabsContent value="results" className="flex-1 px-6 py-5">
        <MethodTabs />
      </TabsContent>

      <TabsContent value="summary" className="flex-1 px-6 py-5 space-y-8">
        <ComparisonTables />
        <RegimeMatrix />
        <SummaryCharts />
      </TabsContent>
    </Tabs>
  );
}
```

- [ ] **Step 2: Verify in browser**

Check: icons appear in tab triggers, "Summary" label (not "Summary & Charts"), py-5 spacing.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/main-tabs.tsx
git commit -m "style: add icons to main tabs, rename Summary label"
```

---

### Task 4: Cross-Section Form

**Files:**
- Modify: `app/src/components/input/cross-section-form.tsx`

- [ ] **Step 1: Rewrite cross-section-form.tsx with Card wrappers, Table components, icons**

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProjectStore } from '@/store/project-store';
import { CrossSectionPoint } from '@/engine/types';
import { CrossSectionChart } from '@/components/cross-section-chart';
import { Plus, Trash2 } from 'lucide-react';

export function CrossSectionForm() {
  const crossSection = useProjectStore((s) => s.crossSection);
  const updateCrossSection = useProjectStore((s) => s.updateCrossSection);

  function addRow() {
    updateCrossSection([
      ...crossSection,
      { station: 0, elevation: 0, manningsN: 0.035, bankStation: null },
    ]);
  }

  function removeRow(index: number) {
    updateCrossSection(crossSection.filter((_, i) => i !== index));
  }

  function updatePoint(index: number, field: keyof CrossSectionPoint, value: string) {
    const updated = [...crossSection];
    if (field === 'bankStation') {
      updated[index] = { ...updated[index], bankStation: value === '—' ? null : value as 'left' | 'right' };
    } else {
      updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
    }
    updateCrossSection(updated);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Cross-Section Data</CardTitle>
          <CardDescription>Define station/elevation points for the channel cross-section</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-10 text-xs">#</TableHead>
                    <TableHead className="text-xs">Station (ft)</TableHead>
                    <TableHead className="text-xs">Elevation (ft)</TableHead>
                    <TableHead className="text-xs">Manning's n</TableHead>
                    <TableHead className="text-xs">Bank</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {crossSection.map((point, i) => (
                    <TableRow key={i} className="even:bg-muted/20">
                      <TableCell className="text-xs text-muted-foreground font-mono">{i + 1}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={point.station}
                          onChange={(e) => updatePoint(i, 'station', e.target.value)}
                          className="h-8 text-sm font-mono"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={point.elevation}
                          onChange={(e) => updatePoint(i, 'elevation', e.target.value)}
                          className="h-8 text-sm font-mono"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={point.manningsN}
                          onChange={(e) => updatePoint(i, 'manningsN', e.target.value)}
                          className="h-8 text-sm font-mono"
                          step="0.001"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={point.bankStation ?? '—'}
                          onValueChange={(v) => updatePoint(i, 'bankStation', v ?? '—')}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="—">—</SelectItem>
                            <SelectItem value="left">Left</SelectItem>
                            <SelectItem value="right">Right</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeRow(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="p-2 border-t">
              <Button variant="outline" size="sm" onClick={addRow} className="w-full">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Row
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Live preview updates as you enter data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <CrossSectionChart crossSection={crossSection} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Check: two cards side-by-side, proper table with zebra striping, Trash2 icons, Plus icon on Add Row.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/input/cross-section-form.tsx
git commit -m "style: upgrade cross-section form with Cards and Table components"
```

---

### Task 5: Bridge Geometry Form

**Files:**
- Modify: `app/src/components/input/bridge-geometry-form.tsx`

- [ ] **Step 1: Rewrite bridge-geometry-form.tsx with Card, Table, Collapsible**

```tsx
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useProjectStore } from '@/store/project-store';
import { BridgeGeometry, Pier } from '@/engine/types';
import { Plus, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export function BridgeGeometryForm() {
  const bridge = useProjectStore((s) => s.bridgeGeometry);
  const update = useProjectStore((s) => s.updateBridgeGeometry);

  function setField(field: string, value: string) {
    update({ ...bridge, [field]: parseFloat(value) || 0 });
  }

  function addPier() {
    update({ ...bridge, piers: [...bridge.piers, { station: 0, width: 3, shape: 'round-nose' }] });
  }

  function removePier(index: number) {
    update({ ...bridge, piers: bridge.piers.filter((_, i) => i !== index) });
  }

  function updatePier(index: number, field: keyof Pier, value: string) {
    const piers = [...bridge.piers];
    if (field === 'shape') {
      piers[index] = { ...piers[index], shape: value as Pier['shape'] };
    } else {
      piers[index] = { ...piers[index], [field]: parseFloat(value) || 0 };
    }
    update({ ...bridge, piers });
  }

  const fields = [
    { key: 'lowChordLeft', label: 'Low Chord Elev. (Left)', unit: 'ft' },
    { key: 'lowChordRight', label: 'Low Chord Elev. (Right)', unit: 'ft' },
    { key: 'highChord', label: 'High Chord Elevation', unit: 'ft' },
    { key: 'leftAbutmentStation', label: 'Left Abutment Station', unit: 'ft' },
    { key: 'rightAbutmentStation', label: 'Right Abutment Station', unit: 'ft' },
    { key: 'leftAbutmentSlope', label: 'Left Abutment Slope', unit: 'H:V' },
    { key: 'rightAbutmentSlope', label: 'Right Abutment Slope', unit: 'H:V' },
    { key: 'skewAngle', label: 'Skew Angle', unit: 'deg' },
  ] as const;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Opening Geometry</CardTitle>
          <CardDescription>Bridge opening dimensions, abutment locations, and skew</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{f.label} <span className="text-muted-foreground/60">({f.unit})</span></Label>
                <Input
                  type="number"
                  value={(bridge as unknown as Record<string, number>)[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pier Data</CardTitle>
          <CardDescription>Define pier locations, widths, and nose shapes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-10 text-xs">#</TableHead>
                  <TableHead className="text-xs">Station (ft)</TableHead>
                  <TableHead className="text-xs">Width (ft)</TableHead>
                  <TableHead className="text-xs">Shape</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bridge.piers.map((pier, i) => (
                  <TableRow key={i} className="even:bg-muted/20">
                    <TableCell className="text-xs text-muted-foreground font-mono">{i + 1}</TableCell>
                    <TableCell>
                      <Input type="number" value={pier.station} onChange={(e) => updatePier(i, 'station', e.target.value)} className="h-8 text-sm font-mono" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={pier.width} onChange={(e) => updatePier(i, 'width', e.target.value)} className="h-8 text-sm font-mono" />
                    </TableCell>
                    <TableCell>
                      <Select value={pier.shape} onValueChange={(v) => updatePier(i, 'shape', v ?? '')}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="square">Square</SelectItem>
                          <SelectItem value="round-nose">Round-nose</SelectItem>
                          <SelectItem value="cylindrical">Cylindrical</SelectItem>
                          <SelectItem value="sharp">Sharp</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => removePier(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-2 border-t">
              <Button variant="outline" size="sm" onClick={addPier} className="w-full">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Pier
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <LowChordProfile bridge={bridge} update={update} />
    </div>
  );
}

function LowChordProfile({ bridge, update }: { bridge: BridgeGeometry; update: (b: BridgeGeometry) => void }) {
  const [open, setOpen] = useState(false);
  const profile = bridge.lowChordProfile;

  function addPoint() {
    update({ ...bridge, lowChordProfile: [...profile, { station: 0, elevation: 0 }] });
  }

  function removePoint(i: number) {
    update({ ...bridge, lowChordProfile: profile.filter((_, idx) => idx !== i) });
  }

  function updatePoint(i: number, field: 'station' | 'elevation', value: string) {
    const pts = [...profile];
    pts[i] = { ...pts[i], [field]: parseFloat(value) || 0 };
    update({ ...bridge, lowChordProfile: pts });
  }

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader>
          <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer">
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <CardTitle>Low Chord Profile</CardTitle>
            <span className="text-xs text-muted-foreground font-normal ml-1">(optional)</span>
          </CollapsibleTrigger>
          <CardDescription>Custom low chord elevations. If blank, linearly interpolates between left and right.</CardDescription>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-10 text-xs">#</TableHead>
                    <TableHead className="text-xs">Station (ft)</TableHead>
                    <TableHead className="text-xs">Elevation (ft)</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profile.map((pt, i) => (
                    <TableRow key={i} className="even:bg-muted/20">
                      <TableCell className="text-xs text-muted-foreground font-mono">{i + 1}</TableCell>
                      <TableCell>
                        <Input type="number" value={pt.station} onChange={(e) => updatePoint(i, 'station', e.target.value)} className="h-8 text-sm font-mono" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={pt.elevation} onChange={(e) => updatePoint(i, 'elevation', e.target.value)} className="h-8 text-sm font-mono" />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => removePoint(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-2 border-t">
                <Button variant="outline" size="sm" onClick={addPoint} className="w-full">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add Point
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
```

- [ ] **Step 2: Verify in browser**

Check: Opening Geometry card, Pier Data card with table, Low Chord Profile collapsible with chevron icon.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/input/bridge-geometry-form.tsx
git commit -m "style: upgrade bridge geometry form with Cards, Tables, Collapsible"
```

---

### Task 6: Flow Profiles Form

**Files:**
- Modify: `app/src/components/input/flow-profiles-form.tsx`

- [ ] **Step 1: Rewrite flow-profiles-form.tsx with Card and Table components**

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProjectStore } from '@/store/project-store';
import { FlowProfile } from '@/engine/types';
import { Plus, Trash2 } from 'lucide-react';

export function FlowProfilesForm() {
  const profiles = useProjectStore((s) => s.flowProfiles);
  const update = useProjectStore((s) => s.updateFlowProfiles);

  function addProfile() {
    update([
      ...profiles,
      { name: '', discharge: 0, dsWsel: 0, channelSlope: 0.001, contractionLength: 0, expansionLength: 0 },
    ]);
  }

  function removeProfile(index: number) {
    update(profiles.filter((_, i) => i !== index));
  }

  function updateProfile(index: number, field: keyof FlowProfile, value: string) {
    const updated = [...profiles];
    if (field === 'name') {
      updated[index] = { ...updated[index], name: value };
    } else {
      updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
    }
    update(updated);
  }

  const columns = [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'discharge', label: 'Q (cfs)', type: 'number' },
    { key: 'dsWsel', label: 'DS WSEL (ft)', type: 'number' },
    { key: 'channelSlope', label: 'Slope (ft/ft)', type: 'number' },
    { key: 'contractionLength', label: 'Contr. L (ft)', type: 'number' },
    { key: 'expansionLength', label: 'Expan. L (ft)', type: 'number' },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flow Profiles</CardTitle>
        <CardDescription>Define up to 10 discharge scenarios with downstream boundary conditions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-10 text-xs">#</TableHead>
                  {columns.map((c) => <TableHead key={c.key} className="text-xs">{c.label}</TableHead>)}
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile, i) => (
                  <TableRow key={i} className="even:bg-muted/20">
                    <TableCell className="text-xs text-muted-foreground font-mono">{i + 1}</TableCell>
                    {columns.map((c) => (
                      <TableCell key={c.key}>
                        <Input
                          type={c.type}
                          value={(profile as unknown as Record<string, string | number>)[c.key]}
                          onChange={(e) => updateProfile(i, c.key as keyof FlowProfile, e.target.value)}
                          className={`h-8 text-sm ${c.type === 'number' ? 'font-mono' : ''}`}
                          step={c.key === 'channelSlope' ? '0.0001' : undefined}
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeProfile(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="p-2 border-t">
            <Button variant="outline" size="sm" onClick={addProfile} className="w-full" disabled={profiles.length >= 10}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Profile
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify in browser**

Check: Card wrapper, proper Table headers, zebra striping, font-mono on numbers, Trash2 icons.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/input/flow-profiles-form.tsx
git commit -m "style: upgrade flow profiles form with Card and Table"
```

---

### Task 7: Coefficients Form

**Files:**
- Modify: `app/src/components/input/coefficients-form.tsx`

- [ ] **Step 1: Rewrite coefficients-form.tsx with Card and method color pips**

```tsx
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProjectStore } from '@/store/project-store';

const METHOD_COLORS: Record<string, string> = {
  energy: 'bg-blue-500',
  momentum: 'bg-emerald-500',
  yarnell: 'bg-amber-500',
  wspro: 'bg-purple-500',
};

export function CoefficientsForm() {
  const coefficients = useProjectStore((s) => s.coefficients);
  const update = useProjectStore((s) => s.updateCoefficients);

  function setField(field: string, value: number) {
    update({ ...coefficients, [field]: value });
  }

  function toggleMethod(method: keyof typeof coefficients.methodsToRun) {
    update({
      ...coefficients,
      methodsToRun: {
        ...coefficients.methodsToRun,
        [method]: !coefficients.methodsToRun[method],
      },
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coefficients & Settings</CardTitle>
        <CardDescription>Loss coefficients, iteration parameters, and method selection</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 max-w-lg">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Energy Method</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Contraction Coeff. (Cc)</Label>
              <Input type="number" value={coefficients.contractionCoeff} onChange={(e) => setField('contractionCoeff', parseFloat(e.target.value) || 0)} className="h-8 text-sm font-mono" step="0.1" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Expansion Coeff. (Ce)</Label>
              <Input type="number" value={coefficients.expansionCoeff} onChange={(e) => setField('expansionCoeff', parseFloat(e.target.value) || 0)} className="h-8 text-sm font-mono" step="0.1" />
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Yarnell Method</div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Pier Shape Coefficient (K)</Label>
            <Input
              type="number"
              value={coefficients.yarnellK ?? ''}
              onChange={(e) => update({ ...coefficients, yarnellK: e.target.value ? parseFloat(e.target.value) : null })}
              className="h-8 text-sm font-mono"
              step="0.1"
              placeholder="Auto from pier shape"
            />
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Iteration Settings</div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Max Iterations</Label>
              <Input type="number" value={coefficients.maxIterations} onChange={(e) => setField('maxIterations', parseInt(e.target.value) || 100)} className="h-8 text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tolerance (ft)</Label>
              <Input type="number" value={coefficients.tolerance} onChange={(e) => setField('tolerance', parseFloat(e.target.value) || 0.01)} className="h-8 text-sm font-mono" step="0.001" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Initial Guess Offset (ft)</Label>
              <Input type="number" value={coefficients.initialGuessOffset} onChange={(e) => setField('initialGuessOffset', parseFloat(e.target.value) || 0.5)} className="h-8 text-sm font-mono" step="0.1" />
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Methods to Run</div>
          <div className="flex gap-6">
            {(['energy', 'momentum', 'yarnell', 'wspro'] as const).map((method) => (
              <div key={method} className="flex items-center gap-2">
                <Checkbox
                  checked={coefficients.methodsToRun[method]}
                  onCheckedChange={() => toggleMethod(method)}
                />
                <span className={`h-2 w-2 rounded-full ${METHOD_COLORS[method]}`} />
                <Label className="text-sm">{method === 'wspro' ? 'WSPRO' : method.charAt(0).toUpperCase() + method.slice(1)}</Label>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify in browser**

Check: single Card, uppercase section dividers, color pips next to method checkboxes, font-mono inputs.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/input/coefficients-form.tsx
git commit -m "style: upgrade coefficients form with Card and method color pips"
```

---

### Task 8: Action Buttons

**Files:**
- Modify: `app/src/components/input/action-buttons.tsx`

- [ ] **Step 1: Rewrite action-buttons.tsx with sticky bar, icons, and inline validation errors**

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useProjectStore } from '@/store/project-store';
import { runAllMethods } from '@/engine/index';
import { validateInputs } from '@/lib/validation';
import { CrossSectionChart } from '@/components/cross-section-chart';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Play, LineChart, RotateCcw, AlertTriangle } from 'lucide-react';

export function ActionButtons() {
  const [plotOpen, setPlotOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const crossSection = useProjectStore((s) => s.crossSection);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const coefficients = useProjectStore((s) => s.coefficients);
  const results = useProjectStore((s) => s.results);
  const setResults = useProjectStore((s) => s.setResults);
  const clearResults = useProjectStore((s) => s.clearResults);

  function handleRunAll() {
    const validationErrors = validateInputs(crossSection, bridgeGeometry, flowProfiles);
    if (validationErrors.length > 0) {
      setErrors(validationErrors.map((e) => e.message));
      return;
    }
    setErrors([]);
    const calcResults = runAllMethods(crossSection, bridgeGeometry, flowProfiles, coefficients);
    setResults(calcResults);
  }

  const methodWsels: Record<string, number> = {};
  if (results) {
    for (const method of ['energy', 'momentum', 'yarnell', 'wspro'] as const) {
      const r = results[method][0];
      if (r && !r.error) methodWsels[method] = r.upstreamWsel;
    }
  }

  return (
    <>
      {errors.length > 0 && (
        <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-1">
            <AlertTriangle className="h-4 w-4" />
            Validation Errors
          </div>
          <ul className="text-sm text-destructive/80 space-y-0.5 pl-6 list-disc">
            {errors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </div>
      )}

      <div className="sticky bottom-0 flex justify-end gap-2 pt-4 pb-3 mt-4 border-t backdrop-blur-sm bg-background/80 -mx-6 px-6">
        <Button variant="outline" size="sm" onClick={() => setPlotOpen(true)}>
          <LineChart className="h-4 w-4 mr-1.5" />
          Plot Cross-Section
        </Button>
        <Button variant="outline" size="sm" onClick={() => { clearResults(); setErrors([]); }}>
          <RotateCcw className="h-4 w-4 mr-1.5" />
          Clear
        </Button>
        <Button onClick={handleRunAll}>
          <Play className="h-4 w-4 mr-1.5" />
          Run All Methods
        </Button>
      </div>

      <Dialog open={plotOpen} onOpenChange={setPlotOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Cross-Section with Bridge Overlay</DialogTitle>
          </DialogHeader>
          <div className="h-[500px]">
            <CrossSectionChart
              crossSection={crossSection}
              bridge={bridgeGeometry}
              wsel={flowProfiles[0]?.dsWsel}
              methodWsels={Object.keys(methodWsels).length > 0 ? methodWsels : undefined}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Verify in browser**

Check: sticky bottom bar with frosted glass, icons on all buttons, primary accent on "Run All Methods", inline validation errors (trigger by running with empty data).

- [ ] **Step 3: Commit**

```bash
git add app/src/components/input/action-buttons.tsx
git commit -m "style: upgrade action buttons with sticky bar, icons, inline errors"
```

---

### Task 9: Method Results — Tabs, View, and Profile Accordion

**Files:**
- Modify: `app/src/components/results/method-tabs.tsx`
- Modify: `app/src/components/results/method-view.tsx`
- Modify: `app/src/components/results/profile-accordion.tsx`

- [ ] **Step 1: Rewrite method-tabs.tsx with color dots**

```tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjectStore } from '@/store/project-store';
import { MethodView } from './method-view';

const methods = [
  {
    key: 'energy',
    label: 'Energy',
    color: 'bg-blue-500',
    name: 'Energy Method',
    reference: 'HEC-RAS Hydraulic Reference Manual, Chapter 5',
    equation: 'WS_us = WS_ds + h_f + h_c + h_e  where h_f = L × (S_f1 + S_f2) / 2',
  },
  {
    key: 'momentum',
    label: 'Momentum',
    color: 'bg-emerald-500',
    name: 'Momentum Method',
    reference: 'HEC-RAS Hydraulic Reference Manual, Chapter 5',
    equation: 'ΣF = ΔM  (net force = change in momentum flux)',
  },
  {
    key: 'yarnell',
    label: 'Yarnell',
    color: 'bg-amber-500',
    name: 'Yarnell Method',
    reference: 'Yarnell, D.L. (1934), "Bridge Piers as Channel Obstructions"',
    equation: 'Δy = K × (K + 5 - 0.6) × (α + 15α⁴) × (V²/2g)',
  },
  {
    key: 'wspro',
    label: 'WSPRO',
    color: 'bg-purple-500',
    name: 'WSPRO Method',
    reference: 'FHWA Report FHWA-IP-87-7, "Bridge Waterways Analysis Model"',
    equation: 'Δh = C × α₁ × (V₁²/2g)',
  },
] as const;

export function MethodTabs() {
  const results = useProjectStore((s) => s.results);

  return (
    <Tabs defaultValue="energy">
      <TabsList className="w-fit mb-4">
        {methods.map((m) => (
          <TabsTrigger key={m.key} value={m.key}>
            <span className={`h-2 w-2 rounded-full ${m.color} mr-1.5`} />
            {m.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {methods.map((m) => (
        <TabsContent key={m.key} value={m.key}>
          <MethodView
            name={m.name}
            reference={m.reference}
            equation={m.equation}
            results={results?.[m.key] ?? []}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
```

- [ ] **Step 2: Rewrite method-view.tsx with Card and improved empty state**

```tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MethodResult } from '@/engine/types';
import { ProfileAccordion } from './profile-accordion';
import { Calculator } from 'lucide-react';

interface MethodViewProps {
  name: string;
  reference: string;
  equation: string;
  results: MethodResult[];
}

export function MethodView({ name, reference, equation, results }: MethodViewProps) {
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Calculator className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">No results yet</p>
        <p className="text-xs mt-1">Configure inputs and run calculations</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle>{name}</CardTitle>
          <CardDescription>{reference}</CardDescription>
        </CardHeader>
        <CardContent>
          <code className="block text-xs bg-muted/30 p-3 rounded-md border font-mono text-primary">{equation}</code>
        </CardContent>
      </Card>
      <ProfileAccordion results={results} />
    </div>
  );
}
```

- [ ] **Step 3: Rewrite profile-accordion.tsx with refined badges and card-style metrics**

```tsx
'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { MethodResult } from '@/engine/types';
import { CalculationSteps } from './calculation-steps';
import { IterationLog } from './iteration-log';

const regimeBadge = {
  'free-surface': { label: 'FREE SURFACE', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  'pressure': { label: 'PRESSURE', className: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  'overtopping': { label: 'OVERTOPPING', className: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
};

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-mono tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

export function ProfileAccordion({ results }: { results: MethodResult[] }) {
  return (
    <Accordion multiple className="space-y-2">
      {results.map((r, i) => {
        const regime = regimeBadge[r.flowRegime];
        return (
          <AccordionItem key={i} value={`profile-${i}`} className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3 flex-1">
                <span className="font-medium">{r.profileName}</span>
                <Badge variant={r.converged ? 'default' : 'destructive'} className={`text-xs ${r.converged ? 'bg-primary/15 text-primary border-primary/30' : ''}`}>
                  {r.converged ? 'CONVERGED' : 'NOT CONVERGED'}
                </Badge>
                <Badge variant="outline" className={`text-xs ${regime.className}`}>{regime.label}</Badge>
                {r.error && <span className="text-xs text-destructive">{r.error}</span>}
              </div>
              <div className="text-sm text-muted-foreground mr-4 font-mono tabular-nums">
                US WSEL: <span className="text-foreground font-medium">{r.upstreamWsel.toFixed(2)} ft</span>
                {' | '}
                Δh: <span className="text-foreground font-medium">{r.totalHeadLoss.toFixed(3)} ft</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Input Echo</div>
                <div className="grid grid-cols-4 gap-2">
                  <MetricCard label="Flow Area" value={`${r.inputEcho.flowArea.toFixed(1)} ft²`} />
                  <MetricCard label="Hydraulic Radius" value={`${r.inputEcho.hydraulicRadius.toFixed(3)} ft`} />
                  <MetricCard label="Bridge Opening Area" value={`${r.inputEcho.bridgeOpeningArea.toFixed(1)} ft²`} />
                  <MetricCard label="Pier Blockage" value={`${r.inputEcho.pierBlockage.toFixed(1)} ft²`} />
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Results</div>
                <div className="grid grid-cols-4 gap-2">
                  <MetricCard label="Approach Velocity" value={`${r.approachVelocity.toFixed(2)} ft/s`} />
                  <MetricCard label="Bridge Velocity" value={`${r.bridgeVelocity.toFixed(2)} ft/s`} />
                  <MetricCard label="Froude (approach)" value={r.froudeApproach.toFixed(3)} />
                  <MetricCard label="Froude (bridge)" value={r.froudeBridge.toFixed(3)} />
                </div>
              </div>

              {r.calculationSteps.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Calculation Steps</div>
                  <CalculationSteps steps={r.calculationSteps} />
                </div>
              )}

              <IterationLog log={r.iterationLog} />

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">TUFLOW Form Loss Coefficients</div>
                <div className="grid grid-cols-2 gap-2 max-w-xs">
                  <MetricCard label="Pier FLC" value={r.tuflowPierFLC.toFixed(3)} />
                  <MetricCard label="Superstructure FLC" value={r.tuflowSuperFLC !== null ? r.tuflowSuperFLC.toFixed(3) : 'N/A'} />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
```

- [ ] **Step 4: Verify in browser**

Run calculations, check: color dots on method tabs, accent left-border on method card, improved empty state, refined badges, metric cards in accordion.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/results/method-tabs.tsx app/src/components/results/method-view.tsx app/src/components/results/profile-accordion.tsx
git commit -m "style: upgrade method results with Cards, color dots, refined badges"
```

---

### Task 10: Calculation Steps & Iteration Log

**Files:**
- Modify: `app/src/components/results/calculation-steps.tsx`
- Modify: `app/src/components/results/iteration-log.tsx`

- [ ] **Step 1: Rewrite calculation-steps.tsx with refined code block styling**

```tsx
'use client';

import { CalculationStep } from '@/engine/types';

export function CalculationSteps({ steps }: { steps: CalculationStep[] }) {
  return (
    <div className="space-y-2 font-mono text-sm bg-muted/20 p-4 rounded-lg border">
      {steps.map((step) => (
        <div key={step.stepNumber} className="space-y-0.5">
          <div>
            <span className="text-muted-foreground font-semibold">{step.stepNumber}.</span>{' '}
            <span className="font-sans">{step.description}</span>
          </div>
          <div className="pl-5 text-muted-foreground text-xs tabular-nums">
            {Object.entries(step.intermediateValues).map(([k, v]) => (
              <span key={k} className="mr-3">
                {k} = {typeof v === 'number' ? v.toFixed(4) : v}
              </span>
            ))}
          </div>
          <div className="pl-5 text-xs">
            <span className="text-primary">{step.formula}</span> = <span className="text-blue-400 font-semibold">{step.result.toFixed(4)} {step.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite iteration-log.tsx with Collapsible and Table**

```tsx
'use client';

import { useState } from 'react';
import { IterationStep } from '@/engine/types';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronRight, ChevronDown } from 'lucide-react';

export function IterationLog({ log }: { log: IterationStep[] }) {
  const [open, setOpen] = useState(false);

  if (log.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Iteration Log ({log.length} iterations)
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 rounded-lg border overflow-auto max-h-[200px]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs w-12">#</TableHead>
                <TableHead className="text-xs text-right">Trial WSEL</TableHead>
                <TableHead className="text-xs text-right">Computed WSEL</TableHead>
                <TableHead className="text-xs text-right">Error (ft)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.map((step) => (
                <TableRow key={step.iteration} className="even:bg-muted/20">
                  <TableCell className="font-mono text-xs">{step.iteration}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">{step.trialWsel.toFixed(4)}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">{step.computedWsel.toFixed(4)}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">{step.error.toFixed(6)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
```

- [ ] **Step 3: Verify in browser**

Run calculations, expand a profile, check: calculation steps with accent formula color, collapsible iteration log with chevron icons, proper Table component.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/results/calculation-steps.tsx app/src/components/results/iteration-log.tsx
git commit -m "style: upgrade calculation steps and iteration log with Collapsible and Table"
```

---

### Task 11: Summary — Comparison Tables

**Files:**
- Modify: `app/src/components/summary/comparison-tables.tsx`
- Modify: `app/src/components/summary/hecras-input-row.tsx`

- [ ] **Step 1: Rewrite comparison-tables.tsx with Card wrappers, Table components, color dots**

```tsx
'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { useProjectStore } from '@/store/project-store';
import { HecRasInputRow } from './hecras-input-row';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MethodResult, HecRasComparison } from '@/engine/types';
import { Calculator } from 'lucide-react';

const METHOD_COLORS: Record<string, string> = {
  energy: 'bg-blue-500',
  momentum: 'bg-emerald-500',
  yarnell: 'bg-amber-500',
  wspro: 'bg-purple-500',
};

function MethodName({ method }: { method: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${METHOD_COLORS[method]}`} />
      <span>{method === 'wspro' ? 'WSPRO' : method.charAt(0).toUpperCase() + method.slice(1)}</span>
    </div>
  );
}

function pctDiffBadge(pct: number | null) {
  if (pct === null) return <span className="text-muted-foreground">—</span>;
  const abs = Math.abs(pct);
  const color = abs < 5
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    : abs < 10
    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    : 'bg-red-500/15 text-red-400 border-red-500/30';
  return <Badge variant="outline" className={`text-xs font-mono ${color}`}>{pct.toFixed(1)}%</Badge>;
}

export function ComparisonTables() {
  const results = useProjectStore((s) => s.results);
  const comparison = useProjectStore((s) => s.hecRasComparison);
  const updateHecRas = useProjectStore((s) => s.updateHecRasComparison);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);

  if (!results) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Calculator className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">No results yet</p>
        <p className="text-xs mt-1">Run calculations to see comparisons</p>
      </div>
    );
  }

  function updateHecRasField(profileName: string, field: keyof HecRasComparison, value: string) {
    const profileNames = flowProfiles.map((p) => p.name);
    const entries = profileNames.map((name) => {
      const existing = comparison.find((c) => c.profileName === name) ?? {
        profileName: name, upstreamWsel: null, headLoss: null, pierFLC: null, superFLC: null,
      };
      if (name === profileName) {
        return { ...existing, [field]: value ? parseFloat(value) : null };
      }
      return existing;
    });
    updateHecRas(entries);
  }

  const profileNames = flowProfiles.map((p) => p.name);
  const methods = ['energy', 'momentum', 'yarnell', 'wspro'] as const;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upstream WSEL Comparison</CardTitle>
          <CardDescription>Upstream water surface elevation (ft) across all methods</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs">Method</TableHead>
                {profileNames.map((n) => <TableHead key={n} className="text-xs text-right">{n}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.map((method) => (
                <TableRow key={method} className="even:bg-muted/20">
                  <TableCell><MethodName method={method} /></TableCell>
                  {results[method].map((r, i) => (
                    <TableCell key={i} className="text-right font-mono tabular-nums">
                      {r.error ? <span className="text-destructive">ERR</span> : r.upstreamWsel.toFixed(2)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              <HecRasInputRow profileNames={profileNames} field="upstreamWsel" />
              <TableRow className="bg-muted/10">
                <TableCell className="text-xs text-muted-foreground">% Diff (Energy vs HEC-RAS)</TableCell>
                {profileNames.map((name, i) => {
                  const hecEntry = comparison.find((c) => c.profileName === name);
                  const energyResult = results.energy[i];
                  if (!hecEntry?.headLoss || !energyResult || energyResult.error) {
                    return <TableCell key={name} className="text-right">—</TableCell>;
                  }
                  const pct = hecEntry.headLoss !== 0
                    ? ((energyResult.totalHeadLoss - hecEntry.headLoss) / hecEntry.headLoss) * 100
                    : null;
                  return <TableCell key={name} className="text-right">{pctDiffBadge(pct)}</TableCell>;
                })}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Head Loss Comparison</CardTitle>
          <CardDescription>Total head loss (ft) across all methods</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleMethodTable profileNames={profileNames} methods={methods} results={results} getValue={(r) => r.totalHeadLoss.toFixed(3)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Approach Velocity</CardTitle>
          <CardDescription>Approach velocity (ft/s) across all methods</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleMethodTable profileNames={profileNames} methods={methods} results={results} getValue={(r) => r.approachVelocity.toFixed(2)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Froude Number</CardTitle>
          <CardDescription>Approach Froude number across all methods</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleMethodTable profileNames={profileNames} methods={methods} results={results} getValue={(r) => r.froudeApproach.toFixed(3)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bridge Opening Area</CardTitle>
          <CardDescription>Net bridge opening area (ft²) across all methods</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleMethodTable profileNames={profileNames} methods={methods} results={results} getValue={(r) => r.inputEcho.bridgeOpeningArea.toFixed(1)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>TUFLOW Form Loss Coefficients</CardTitle>
          <CardDescription>Pier and superstructure FLCs for TUFLOW modelling</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs">Method</TableHead>
                {profileNames.map((n) => <TableHead key={n} className="text-xs text-center" colSpan={2}>{n}</TableHead>)}
              </TableRow>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableHead></TableHead>
                {profileNames.map((n) => (
                  <React.Fragment key={n}>
                    <TableHead className="text-right text-xs text-muted-foreground">Pier</TableHead>
                    <TableHead className="text-right text-xs text-muted-foreground">Super</TableHead>
                  </React.Fragment>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.map((method) => (
                <TableRow key={method} className="even:bg-muted/20">
                  <TableCell><MethodName method={method} /></TableCell>
                  {results[method].map((r, i) => (
                    <React.Fragment key={i}>
                      <TableCell className="text-right font-mono tabular-nums text-sm">{r.error ? 'ERR' : r.tuflowPierFLC.toFixed(3)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-sm">{r.error ? 'ERR' : (r.tuflowSuperFLC !== null ? r.tuflowSuperFLC.toFixed(3) : 'N/A')}</TableCell>
                    </React.Fragment>
                  ))}
                </TableRow>
              ))}
              <TableRow className="bg-amber-500/5 border-y border-amber-500/20">
                <TableCell className="text-sm font-semibold text-amber-400">HEC-RAS</TableCell>
                {profileNames.map((name) => {
                  const entry = comparison.find((c) => c.profileName === name);
                  return (
                    <React.Fragment key={name}>
                      <TableCell className="px-1">
                        <Input type="number" value={entry?.pierFLC ?? ''} onChange={(e) => updateHecRasField(name, 'pierFLC', e.target.value)} className="h-7 text-sm font-mono w-16" placeholder="—" />
                      </TableCell>
                      <TableCell className="px-1">
                        <Input type="number" value={entry?.superFLC ?? ''} onChange={(e) => updateHecRasField(name, 'superFLC', e.target.value)} className="h-7 text-sm font-mono w-16" placeholder="—" />
                      </TableCell>
                    </React.Fragment>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SimpleMethodTable({ profileNames, methods, results, getValue }: {
  profileNames: string[];
  methods: readonly ('energy' | 'momentum' | 'yarnell' | 'wspro')[];
  results: NonNullable<ReturnType<typeof useProjectStore.getState>['results']>;
  getValue: (r: MethodResult) => string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableHead className="text-xs">Method</TableHead>
          {profileNames.map((n) => <TableHead key={n} className="text-xs text-right">{n}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {methods.map((method) => (
          <TableRow key={method} className="even:bg-muted/20">
            <TableCell><MethodName method={method} /></TableCell>
            {results[method].map((r, i) => (
              <TableCell key={i} className="text-right font-mono tabular-nums">
                {r.error ? <span className="text-destructive">ERR</span> : getValue(r)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Rewrite hecras-input-row.tsx with refined gold styling and font-mono**

```tsx
'use client';

import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import { useProjectStore } from '@/store/project-store';
import { HecRasComparison } from '@/engine/types';

export function HecRasInputRow({ profileNames, field }: {
  profileNames: string[];
  field: 'upstreamWsel' | 'headLoss' | 'pierFLC' | 'superFLC';
}) {
  const comparison = useProjectStore((s) => s.hecRasComparison);
  const update = useProjectStore((s) => s.updateHecRasComparison);

  function getEntry(name: string): HecRasComparison {
    return comparison.find((c) => c.profileName === name) ?? {
      profileName: name, upstreamWsel: null, headLoss: null, pierFLC: null, superFLC: null,
    };
  }

  function setField(profileName: string, value: string) {
    const entries = profileNames.map((name) => {
      const entry = getEntry(name);
      if (name === profileName) {
        return { ...entry, [field]: value ? parseFloat(value) : null };
      }
      return entry;
    });
    update(entries);
  }

  return (
    <TableRow className="bg-amber-500/5 border-y border-amber-500/20 hover:bg-amber-500/10">
      <TableCell className="text-sm font-semibold text-amber-400">HEC-RAS</TableCell>
      {profileNames.map((name) => {
        const entry = getEntry(name);
        return (
          <TableCell key={name} className="px-1">
            <Input
              type="number"
              value={entry[field] ?? ''}
              onChange={(e) => setField(name, e.target.value)}
              className="h-7 text-sm font-mono w-20"
              placeholder="—"
            />
          </TableCell>
        );
      })}
    </TableRow>
  );
}
```

- [ ] **Step 3: Verify in browser**

Run calculations, go to Summary tab. Check: Card-wrapped tables, color dots next to method names, refined HEC-RAS gold rows, font-mono numbers, improved empty state.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/summary/comparison-tables.tsx app/src/components/summary/hecras-input-row.tsx
git commit -m "style: upgrade comparison tables with Cards, Table components, color dots"
```

---

### Task 12: Summary — Regime Matrix & Charts

**Files:**
- Modify: `app/src/components/summary/regime-matrix.tsx`
- Modify: `app/src/components/summary/charts.tsx`

- [ ] **Step 1: Rewrite regime-matrix.tsx with Card and Table**

```tsx
'use client';

import { useProjectStore } from '@/store/project-store';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const METHOD_COLORS: Record<string, string> = {
  energy: 'bg-blue-500',
  momentum: 'bg-emerald-500',
  yarnell: 'bg-amber-500',
  wspro: 'bg-purple-500',
};

const regimeStyle = {
  'free-surface': { label: 'F', full: 'Free Surface', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  'pressure': { label: 'P', full: 'Pressure', className: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  'overtopping': { label: 'O', full: 'Overtopping', className: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
};

export function RegimeMatrix() {
  const results = useProjectStore((s) => s.results);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);

  if (!results) return null;

  const methods = ['energy', 'momentum', 'yarnell', 'wspro'] as const;
  const profileNames = flowProfiles.map((p) => p.name);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flow Regime Matrix</CardTitle>
        <CardDescription>
          F = Free Surface, P = Pressure, O = Overtopping
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs">Method</TableHead>
              {profileNames.map((n) => <TableHead key={n} className="text-xs text-center">{n}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {methods.map((method) => (
              <TableRow key={method} className="even:bg-muted/20">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${METHOD_COLORS[method]}`} />
                    <span>{method === 'wspro' ? 'WSPRO' : method.charAt(0).toUpperCase() + method.slice(1)}</span>
                  </div>
                </TableCell>
                {results[method].map((r, i) => {
                  const style = regimeStyle[r.flowRegime];
                  return (
                    <TableCell key={i} className="text-center">
                      <Badge variant="outline" className={`text-xs ${style.className}`} title={style.full}>{style.label}</Badge>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Rewrite charts.tsx with Card wrappers and updated tooltip styling**

```tsx
'use client';

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { useProjectStore } from '@/store/project-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const COLORS = {
  energy: '#3b82f6',
  momentum: '#10b981',
  yarnell: '#f59e0b',
  wspro: '#8b5cf6',
  hecras: '#ef4444',
};

const tooltipStyle = {
  backgroundColor: 'oklch(0.17 0.01 230)',
  border: '1px solid oklch(0.26 0.02 230)',
  borderRadius: '8px',
};

export function SummaryCharts() {
  const results = useProjectStore((s) => s.results);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);

  if (!results) return null;

  const methods = ['energy', 'momentum', 'yarnell', 'wspro'] as const;

  const headLossData = flowProfiles.map((p, i) => {
    const row: Record<string, string | number> = { name: p.name };
    for (const m of methods) {
      const r = results[m][i];
      if (r && !r.error) row[m] = parseFloat(r.totalHeadLoss.toFixed(3));
    }
    return row;
  });

  const wselData = flowProfiles.map((p, i) => {
    const row: Record<string, string | number> = { Q: p.discharge };
    for (const m of methods) {
      const r = results[m][i];
      if (r && !r.error) row[m] = parseFloat(r.upstreamWsel.toFixed(2));
    }
    return row;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Head Loss Comparison</CardTitle>
          <CardDescription>Total head loss by method across all flow profiles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={headLossData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.02 230)" />
                <XAxis dataKey="name" stroke="oklch(0.50 0.01 260)" fontSize={12} />
                <YAxis label={{ value: 'Head Loss (ft)', angle: -90, position: 'insideLeft' }} stroke="oklch(0.50 0.01 260)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                {methods.map((m) => (
                  <Bar key={m} dataKey={m} fill={COLORS[m]} name={m === 'wspro' ? 'WSPRO' : m.charAt(0).toUpperCase() + m.slice(1)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upstream WSEL vs Discharge</CardTitle>
          <CardDescription>Water surface elevation trend across discharge scenarios</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={wselData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.02 230)" />
                <XAxis dataKey="Q" label={{ value: 'Discharge (cfs)', position: 'bottom', offset: -5 }} stroke="oklch(0.50 0.01 260)" fontSize={12} />
                <YAxis label={{ value: 'US WSEL (ft)', angle: -90, position: 'insideLeft' }} stroke="oklch(0.50 0.01 260)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                {methods.map((m) => (
                  <Line key={m} type="monotone" dataKey={m} stroke={COLORS[m]} name={m === 'wspro' ? 'WSPRO' : m.charAt(0).toUpperCase() + m.slice(1)} dot={{ r: 4 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Run calculations, check Summary tab: Card-wrapped regime matrix with tooltips on badges, Card-wrapped charts with descriptions, updated chart grid/tooltip colors matching new palette.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/summary/regime-matrix.tsx app/src/components/summary/charts.tsx
git commit -m "style: upgrade regime matrix and charts with Cards and refined styling"
```

---

### Task 13: Cross-Section Chart Tooltip Styling

**Files:**
- Modify: `app/src/components/cross-section-chart.tsx`

- [ ] **Step 1: Update tooltip styling to match new palette**

In `cross-section-chart.tsx`, update the `Tooltip` `contentStyle` prop from:

```tsx
contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px' }}
```

to:

```tsx
contentStyle={{ backgroundColor: 'oklch(0.17 0.01 230)', border: '1px solid oklch(0.26 0.02 230)', borderRadius: '8px' }}
```

- [ ] **Step 2: Verify in browser**

Plot cross-section, hover over data points. Check tooltip has blue-tinted dark background.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/cross-section-chart.tsx
git commit -m "style: update cross-section chart tooltip to match slate-blue palette"
```

---

### Task 14: Final Visual Verification

- [ ] **Step 1: Run dev server and check all tabs**

Run: `cd app && npm run dev`

Walk through:
1. Input tab → Cross-Section: Card wrappers, Table, preview card
2. Input tab → Bridge Geometry: Card, Table, Collapsible low chord
3. Input tab → Flow Profiles: Card, Table
4. Input tab → Coefficients: Card, section dividers, color pips
5. Click "Run All Methods" with empty data → inline error banner
6. Enter valid data, run calculations
7. Method Results → color dots, accent-bordered method card, accordion with refined badges
8. Summary → Card-wrapped tables with color dots, HEC-RAS gold rows, charts

- [ ] **Step 2: Check for build errors**

Run: `cd app && npm run build`

Expected: Build succeeds with no errors.

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address visual verification issues"
```
