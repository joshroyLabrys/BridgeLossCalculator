# Data Import

## Purpose

This module parses survey data files into `CrossSectionPoint[]` arrays that the engine can consume. Bridge cross-section data comes from a variety of sources -- survey instruments, CAD exports, spreadsheets -- and this parser handles the most common formats.

## CSV Survey Parser (`csv-survey-parser.ts`)

### Supported Formats

The parser handles tabular text data in these formats:

- **CSV** (comma-separated values)
- **TSV** (tab-separated values)
- **TXT** (space-delimited, including multi-space delimited)
- **12D exports** (space or comma delimited station/elevation pairs)
- **Civil3D exports** (CSV with header rows)

The parser auto-detects the delimiter and header row, so the user does not need to specify the file format manually.

### Delimiter Detection

The `detectDelimiter()` function examines the second non-empty line (to skip potential headers) and counts occurrences of three candidate delimiters:

| Candidate  | Detection logic |
|------------|-----------------|
| Tab (`\t`) | Wins if tab count >= comma and space counts |
| Comma (`,`)| Wins if comma count >= space count |
| Multi-space| Wins if two or more consecutive spaces are found |
| Single space | Fallback: if whitespace-split produces 2+ tokens |

Default fallback is comma.

### Header Detection

The `detectHeaders()` function checks whether the first row contains any non-numeric values. If so, it is treated as a header row and the values are returned as column labels. If all values in the first row are numeric, no header is assumed.

### Column Mapping

The user (or auto-detection logic in the UI) provides a `ColumnMapping`:

```typescript
interface ColumnMapping {
  station: number;     // column index for station values
  elevation: number;   // column index for elevation values
  manningsN?: number;  // optional column index for Manning's n
}
```

If the Manning's n column is not mapped (or set to -1), a default value is used (0.035 by default).

### Parsing

The `parseCsvSurvey()` function:

1. Splits the input text into lines, filtering out empty lines.
2. Skips the first line if `hasHeader` is true.
3. For each data line, splits by the detected delimiter and extracts station and elevation from the mapped columns.
4. Skips lines where station or elevation cannot be parsed as numbers.
5. Optionally reads Manning's n from a third column if mapped.
6. Returns the points sorted by station ascending.

### Example Usage

```typescript
import { detectDelimiter, detectHeaders, parseCsvSurvey } from './csv-survey-parser';

const text = `Station,Elevation,n
0,100.5,0.035
10,99.2,0.035
20,97.8,0.030
30,99.0,0.035
40,100.3,0.035`;

const delimiter = detectDelimiter(text);     // ','
const headers = detectHeaders(text, delimiter); // ['Station', 'Elevation', 'n']

const points = parseCsvSurvey(
  text,
  { station: 0, elevation: 1, manningsN: 2 },
  delimiter,
  true,   // has header
  0.035   // default n (used if column parse fails)
);
// Returns 5 CrossSectionPoint objects sorted by station
```

### Limitations

- The parser does not handle quoted fields with embedded delimiters (e.g., `"Station, ft"`).
- Bank stations are not detected from the CSV data -- all points are imported with `bankStation: null`. The user must assign bank stations in the UI after import.
- Coordinate system and datum are not validated. The user is responsible for ensuring consistent units and datum between the survey data and the bridge geometry.
- 3D point data (easting/northing/elevation) must be pre-processed into chainage/elevation pairs before import.
