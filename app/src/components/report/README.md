# Report Components

This directory contains components for generating, editing, and managing analysis reports. These appear under the **Report** tab.

## Components

### NarrativeEditor

**File:** `narrative-editor.tsx`

An AI-powered report narrative editor that generates professional report text from the current project state.

**Section definitions** come from `@/lib/api/narrative-prompts` (the `NARRATIVE_SECTIONS` array). Each section has an id, title, description, and an optional `requiresData` field indicating which store data must be present (e.g., `'results'`, `'scourResults'`, `'sensitivityResults'`).

**Tone selector:**
A toggle between "Technical" and "Summary" modes. The selected tone is sent to the AI API and affects the style and depth of generated text.

**Per-section cards:**
Each section is a collapsible card showing:
- Title and description.
- Status badge: "Empty" (outline), "Generated" (default), or "Edited" (secondary).
- **Generate / Regenerate** button -- calls `/api/ai-narrative` with the section ID, tone, and a project data payload assembled from the store (bridge geometry, coefficients, flow profiles, results, freeboard, scour, sensitivity, and adequacy data).
- Editable textarea -- content can be manually edited after generation, which changes the status to "Edited."
- Regeneration safety: if the section has been edited, clicking Regenerate shows a "Overwrite edits?" confirmation.
- Sections that require missing data show a disabled state with an explanation.

**Generate All** button processes all empty sections sequentially (not in parallel) to avoid overwhelming the API.

**Lazy initialization:** on first render, if no narrative sections exist in the store, they are populated from the NARRATIVE_SECTIONS definitions with empty content.

### ExportPanel

**File:** `export-panel.tsx`

Centralized export controls for all output formats.

**PDF Report with section selection:**
A checklist of 9 toggleable PDF sections:
1. Cover Page -- title page with project name and date.
2. Input Summary -- cross-section, bridge geometry, flow profiles.
3. Hydraulic Analysis -- method results, HEC-RAS comparison, AI analysis.
4. Analysis Overview -- comparison tables, afflux charts, regime matrix.
5. Scour Assessment -- pier and contraction scour results (requires scour data).
6. Adequacy and Freeboard -- verdict and freeboard per AEP (requires adequacy data).
7. Regulatory Compliance -- checklist status (requires checklist items).
8. AI Narrative -- generated narrative sections (requires narrative content).
9. Appendices -- iteration logs and detailed calculation steps.

Sections without the required data are shown as disabled with "(no data)". Select All / Deselect All buttons for convenience. The PDF is generated client-side via dynamic import of `@/components/pdf-report` and includes a 3D scene capture (screenshot of the Three.js canvas via `toDataURL`).

**Other exports:**
- **Export Project JSON** -- serializes the full project state for re-import.
- **Cross-Section CSV** -- exports station/elevation/Manning's n data.
- **Results CSV** -- exports calculation results for all methods and profiles.
- **QA/QC Memo PDF** -- shortcut to the QA memo (shown when HEC-RAS comparison data exists).
- **Regulatory Summary PDF** -- shortcut (shown when checklist items exist).

### HistoryPanel

**File:** `history-panel.tsx`

Snapshot-based project versioning stored in localStorage.

**Save snapshots:**
- Dialog with name and optional note fields.
- Generates a summary line from the current energy method results (last profile WSEL and freeboard).
- Maximum 20 snapshots; shows a warning when approaching the limit.
- Snapshots are stored as `ProjectSnapshot` objects containing a full `SerializedProjectState`.

**Snapshot list:**
- Sorted by timestamp (newest first).
- Each card shows: name, relative time ("5m ago", "2d ago"), summary line, and optional note.
- **Restore** button (with confirmation dialog) replaces all current project data.
- **Delete** button (with confirmation dialog) permanently removes the snapshot.
- Checkbox selection for comparison (max 2).

**Compare / Diff view:**
When two snapshots are selected and "Compare Selected" is clicked:
- **Input Changes** table: shows which parameters differ between the two snapshots (contraction/expansion coefficients, debris %, Yarnell K, freeboard threshold, average Manning's n, low/high chord, bridge span, pier count, skew angle, flow profile count).
- **Result Deltas** table: shows per-profile differences in US WSEL, Head Loss, and Freeboard with color-coded delta values (green = improvement, red = degradation).

**Export/Import:**
- **Export** -- downloads all snapshots as a JSON array.
- **Import** -- merges snapshots from a JSON file, deduplicating by ID, capping at 20 total.

Snapshots persist to `localStorage` under the key `'project-snapshots'`.
