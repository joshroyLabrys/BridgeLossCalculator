# Data Management Components

This directory contains components for importing external data and managing multi-bridge reach analysis. These appear under the **Data** tab.

## Components

### ImportPanel

**File:** `import-panel.tsx`

A unified file import interface supporting multiple formats with drag-and-drop.

**Supported file types:**
- **CSV / TXT** -- cross-section survey data with interactive column mapping.
- **HEC-RAS** (.g01, .f01, .r01, .p01, etc.) -- redirects to the HEC-RAS import dialog on the Data tab header.
- **JSON** -- full project file import via the store's `importProject()`.

**CSV import workflow:**
1. User drops a file or clicks to browse. The file is read as text.
2. **Delimiter detection** -- auto-detects comma, tab, or space using `detectDelimiter()`.
3. **Header detection** -- uses `detectHeaders()` to determine if the first row contains column names.
4. **Preview table** -- shows the first 20 data rows with color-coded columns based on assigned roles.
5. **Column mapping** -- each column gets a dropdown: Ignore, Station, Elevation, or Manning's N. Auto-assignment tries to match column headers using regex patterns (e.g., `/stat|chainage|dist/` maps to Station). If no headers match, the first two columns default to Station and Elevation.
6. **Delimiter override** -- buttons for Comma, Tab, and Space in case auto-detection is wrong.
7. **Header toggle** -- checkbox to indicate whether the first row is a header.
8. **Replace vs. Append** -- toggle for whether imported data replaces existing cross-section points or is merged and sorted by station.
9. **Validation feedback** -- shows whether Station and Elevation columns are assigned, with row count.
10. **Apply Import** button parses the full file using `parseCsvSurvey()` and updates the store.

**Drop zone:**
A dashed-border area with drag-over highlighting. Accepts single file drops. The file input accepts `.csv`, `.txt`, `.json`, and HEC-RAS extensions.

### ReachManager

**File:** `reach-manager.tsx`

Manages single-bridge vs. multi-bridge reach analysis mode.

**Single vs. Reach mode toggle:**
- When reach mode is disabled, the application operates on a single bridge.
- Enabling reach mode creates the first bridge from the current project state and switches to a multi-bridge management interface.

**Bridge list:**
- Up to 5 bridges, each with a name and chainage (distance along the reach).
- Add/remove bridge buttons (with delete confirmation).
- Clicking a bridge selects it as the active bridge, loading its cross-section and geometry into the main editing forms.

**Per-bridge data:**
Each `BridgeProject` in the store contains its own:
- Cross-section points
- Bridge geometry
- Coefficients
- Chainage (position along reach)

**Bridge completeness indicator:**
Each bridge shows a status badge: complete (green check) if it has at least 2 cross-section points and a high chord > 0, or incomplete (amber warning) otherwise.

**Run Reach Analysis:**
When all bridges are complete, the "Run Reach Analysis" button calls `runReachAnalysis()` from the engine, which analyzes the backwater cascade through the series of bridges. Results are stored via `setReachResults()`.

**SVG schematic:**
A visual representation of the reach showing bridges positioned at their chainages along a line, providing a spatial overview of the multi-bridge configuration.
