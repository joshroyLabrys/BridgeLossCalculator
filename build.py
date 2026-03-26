"""
Bridge Loss Calculator — Build Script
Assembles BridgeLossCalculator.xlsm from VBA modules + sheet formatting.
Requires: Windows, Excel installed, pywin32
"""
import os
import sys
import time
import win32com.client as win32

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
VBA_DIR = os.path.join(SCRIPT_DIR, "src", "vba")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "BridgeLossCalculator.xlsm")

# Excel constants
XL_MACRO_ENABLED = 52   # xlOpenXMLWorkbookMacroEnabled
XL_VALIDATE_LIST = 3    # xlValidateList

# Border location constants
XL_EDGE_TOP              = 8
XL_EDGE_BOTTOM           = 9
XL_EDGE_LEFT             = 7
XL_EDGE_RIGHT            = 10
XL_INSIDE_HORIZONTAL     = 12
XL_INSIDE_VERTICAL       = 11

# Border style constants
XL_CONTINUOUS = 1
XL_THIN       = 2
XL_MEDIUM     = -4138
XL_NONE       = -4142

# Alignment
XL_HALIGN_CENTER = -4108
XL_HALIGN_RIGHT  = -4152
XL_HALIGN_LEFT   = -4131

# ── Color palette ──────────────────────────────────────────────────────────────
NAV_DARK   = (27,  42,  74)   # primary header — dark navy
NAV_MED    = (61,  90, 128)   # section headers — steel blue
NAV_LIGHT  = (232, 238, 244)  # sub-headers — light blue-gray
INPUT_FILL = (255, 255, 240)  # input cells — very light yellow
WHITE      = (255, 255, 255)
GRAY_DARK  = (64,  64,  64)
GRAY_MID   = (128, 128, 128)
GRAY_LIGHT = (242, 242, 242)
GRAY_ALT   = (249, 249, 249)  # alternating row tint


def _rgb(r, g, b):
    """Convert RGB to Excel COM color integer (BGR order)."""
    return r + g * 256 + b * 65536


# ── Layout constants (must mirror mod_Utilities.bas) ──────────────────────────
#
# Row 1  : Title bar
# Row 2  : Subtitle / run info
# Row 3  : Buttons
# Row 4  : (spacer)
# Row 5  : Zone 1 banner  — RIVER CROSS-SECTION
# Row 6  : XS column headers          XS_HEADER_ROW = 6
# Rows 7-56: XS data (50 rows)        XS_FIRST_DATA = 7
# Row 57 : (spacer)
# Row 58 : Zone 2 banner  — BRIDGE GEOMETRY
# Row 59 : sub-header "Opening Dimensions"
# Rows 60-67: Bridge geometry rows    BRIDGE_START_ROW = 60
# Row 68 : (spacer)
# Row 69 : sub-header "Pier Data"
# Row 70 : Pier column headers        PIER_HEADER_ROW = 70
# Rows 71-80: Pier data (10 rows)     PIER_FIRST_DATA = 71
# Row 81 : (spacer)
# Row 82 : Zone 3 banner  — FLOW PROFILES
# Row 83 : Flow column headers        FLOW_HEADER_ROW = 83
# Rows 84-93: Flow data (10 rows)     FLOW_FIRST_DATA = 84
# Row 94 : (spacer)
# Row 95 : Zone 4 banner  — COEFFICIENTS & SETTINGS
# Row 96 : sub-header "Energy Method"   COEFF_START_ROW = 96
# Row 97 : Cc                           (COEFF_START_ROW + 1)
# Row 98 : Ce                           (COEFF_START_ROW + 2)
# Row 99 : (spacer)
# Row 100: sub-header "Yarnell Method"
# Row 101: K override                   (COEFF_START_ROW + 5)
# Row 102: (spacer)
# Row 103: sub-header "Iteration Settings"
# Row 104: Max Iterations               (COEFF_START_ROW + 8)
# Row 105: Tolerance                    (COEFF_START_ROW + 9)
# Row 106: Initial Guess Offset         (COEFF_START_ROW + 10)
# Row 107: (spacer)
# Row 108: Methods to Run labels
# Row 109: Methods to Run toggles

XS_FIRST_DATA    = 7
XS_HEADER_ROW    = 6
BRIDGE_START_ROW = 60
PIER_HEADER_ROW  = 70
PIER_FIRST_DATA  = 71
FLOW_HEADER_ROW  = 83
FLOW_FIRST_DATA  = 84
COEFF_START_ROW  = 96

# Column positions (1-based) — col A is visual spacer
COL_SPACER      = 1   # A — narrow spacer strip
COL_LABEL       = 2   # B — labels / Point #
COL_STATION     = 3   # C — Station (ft)  / value column for label-value pairs
COL_ELEV        = 4   # D — Elevation (ft)
COL_MANN        = 5   # E — Manning's n
COL_BANK        = 6   # F — Bank Station label
COL_EXTRA       = 7   # G — spare / Expansion reach


def _banner_row(ws, row, text, col_start="A", col_end="H",
                bg=NAV_DARK, fg=WHITE, size=11, height=22):
    """Write a full-width colored banner row (merged cells)."""
    rng = ws.Range(f"{col_start}{row}:{col_end}{row}")
    rng.Merge()
    rng.Value = text
    rng.Font.Bold = True
    rng.Font.Size = size
    rng.Font.Color = _rgb(*fg)
    rng.Interior.Color = _rgb(*bg)
    rng.HorizontalAlignment = XL_HALIGN_LEFT
    rng.IndentLevel = 1
    ws.Rows(row).RowHeight = height


def _sub_header_row(ws, row, text, col_start="B", col_end="H",
                    bg=NAV_LIGHT, fg=GRAY_DARK, height=18):
    """Write a sub-section header row."""
    rng = ws.Range(f"{col_start}{row}:{col_end}{row}")
    rng.Merge()
    rng.Value = text
    rng.Font.Bold = True
    rng.Font.Size = 9
    rng.Font.Color = _rgb(*fg)
    rng.Interior.Color = _rgb(*bg)
    rng.HorizontalAlignment = XL_HALIGN_LEFT
    rng.IndentLevel = 1
    ws.Rows(row).RowHeight = height


def _col_header_row(ws, row, headers, bg=NAV_MED, fg=WHITE, height=17):
    """Write a column-header row with steel-blue fill.

    headers: dict of {col_letter: label_text}
    """
    for col, label in headers.items():
        cell = ws.Range(f"{col}{row}")
        cell.Value = label
        cell.Font.Bold = True
        cell.Font.Size = 9
        cell.Font.Color = _rgb(*fg)
        cell.Interior.Color = _rgb(*bg)
        cell.HorizontalAlignment = XL_HALIGN_CENTER
        cell.Borders(XL_EDGE_BOTTOM).LineStyle = XL_CONTINUOUS
        cell.Borders(XL_EDGE_BOTTOM).Weight = XL_THIN
    ws.Rows(row).RowHeight = height


def _input_cell(ws, addr):
    """Apply input-cell styling (light yellow fill + thin border)."""
    cell = ws.Range(addr)
    cell.Interior.Color = _rgb(*INPUT_FILL)
    for side in [XL_EDGE_TOP, XL_EDGE_BOTTOM, XL_EDGE_LEFT, XL_EDGE_RIGHT]:
        cell.Borders(side).LineStyle = XL_CONTINUOUS
        cell.Borders(side).Weight = XL_THIN
        cell.Borders(side).Color = _rgb(180, 180, 200)


def _label_value_row(ws, row, label, default_val=None, units="",
                     label_col="B", value_col="C", bold_label=False):
    """Write a label in col B (right-aligned) and an input cell in col C."""
    lbl = ws.Range(f"{label_col}{row}")
    lbl.Value = label if not units else f"{label}  [{units}]"
    lbl.Font.Size = 9
    lbl.Font.Bold = bold_label
    lbl.Font.Color = _rgb(*GRAY_DARK)
    lbl.HorizontalAlignment = XL_HALIGN_RIGHT
    lbl.Interior.Color = _rgb(*WHITE)

    val = ws.Range(f"{value_col}{row}")
    if default_val is not None:
        val.Value = default_val
    _input_cell(ws, f"{value_col}{row}")
    ws.Rows(row).RowHeight = 16


def _spacer_row(ws, row, height=6):
    """Set a thin spacer row with no fill."""
    ws.Rows(row).RowHeight = height


def _thin_accent_border(ws, row, col_start, col_end):
    """Draw a thin blue horizontal accent line under the given row."""
    rng = ws.Range(f"{col_start}{row}:{col_end}{row}")
    border = rng.Borders(XL_EDGE_BOTTOM)
    border.LineStyle = XL_CONTINUOUS
    border.Weight = XL_THIN
    border.Color = _rgb(*NAV_MED)


# ── Sheet creation ─────────────────────────────────────────────────────────────

def create_workbook():
    """Create a new Excel workbook with all sheets."""
    excel = win32.gencache.EnsureDispatch("Excel.Application")
    excel.Visible = False
    excel.DisplayAlerts = False
    wb = excel.Workbooks.Add()

    sheet_names = [
        "Instructions",
        "Input",
        "Energy Method",
        "Momentum Method",
        "Yarnell",
        "WSPRO",
        "Summary & Charts",
    ]

    while wb.Sheets.Count > 1:
        wb.Sheets(wb.Sheets.Count).Delete()

    wb.Sheets(1).Name = sheet_names[0]
    for name in sheet_names[1:]:
        wb.Sheets.Add(After=wb.Sheets(wb.Sheets.Count)).Name = name

    return excel, wb


def import_vba_modules(wb):
    """Import all .bas files from src/vba/ into the workbook."""
    vba_project = wb.VBProject
    for filename in sorted(os.listdir(VBA_DIR)):
        if filename.endswith(".bas"):
            filepath = os.path.join(VBA_DIR, filename)
            vba_project.VBComponents.Import(filepath)
            print(f"  Imported {filename}")


# ── Input sheet ────────────────────────────────────────────────────────────────

def format_input_sheet(wb, excel):
    """Set up the Input sheet with a professional dashboard layout."""
    ws = wb.Sheets("Input")

    # ── Tab color ─────────────────────────────────────────────────────────────
    ws.Tab.Color = _rgb(*NAV_DARK)

    # ── Column widths ─────────────────────────────────────────────────────────
    ws.Columns("A").ColumnWidth = 1.2   # visual spacer strip
    ws.Columns("B").ColumnWidth = 26    # labels
    ws.Columns("C").ColumnWidth = 14    # station / values
    ws.Columns("D").ColumnWidth = 14    # elevation
    ws.Columns("E").ColumnWidth = 13    # Manning's n
    ws.Columns("F").ColumnWidth = 14    # bank station
    ws.Columns("G").ColumnWidth = 14    # expansion reach
    ws.Columns("H").ColumnWidth = 4     # right margin

    # ── Row 1: workbook title bar ─────────────────────────────────────────────
    rng = ws.Range("A1:H1")
    rng.Merge()
    rng.Value = "  BRIDGE LOSS CALCULATOR"
    rng.Font.Bold = True
    rng.Font.Size = 16
    rng.Font.Color = _rgb(*WHITE)
    rng.Interior.Color = _rgb(*NAV_DARK)
    rng.HorizontalAlignment = XL_HALIGN_LEFT
    ws.Rows(1).RowHeight = 36

    # ── Row 2: subtitle ───────────────────────────────────────────────────────
    rng = ws.Range("A2:H2")
    rng.Merge()
    rng.Value = "    HEC-RAS Validation Tool  \u2014  Input Data"
    rng.Font.Italic = True
    rng.Font.Size = 10
    rng.Font.Color = _rgb(*GRAY_MID)
    rng.Interior.Color = _rgb(236, 240, 246)
    ws.Rows(2).RowHeight = 18

    # ── Row 3: buttons row — keep height for button shapes ────────────────────
    ws.Rows(3).RowHeight = 32
    rng3 = ws.Range("A3:H3")
    rng3.Interior.Color = _rgb(245, 247, 250)
    # (buttons are positioned here by add_buttons())

    # ── Row 4: spacer before first zone ───────────────────────────────────────
    _spacer_row(ws, 4, height=8)

    # ── Zone 1: River Cross-Section ───────────────────────────────────────────
    _banner_row(ws, 5, "  \u25a0  ZONE 1 \u2014 RIVER CROSS-SECTION",
                col_start="A", col_end="H", height=22)

    _col_header_row(ws, XS_HEADER_ROW, {
        "B": "Point #",
        "C": "Station (ft)",
        "D": "Elevation (ft)",
        "E": "Manning's n",
        "F": "Bank Station",
    }, height=17)

    # Data rows 7-56: alternating fill + auto-number in col B, input cells C-F
    for i in range(50):
        r = XS_FIRST_DATA + i
        fill_color = GRAY_ALT if i % 2 == 0 else WHITE

        # Col B: auto-number (display only)
        pnum = ws.Range(f"B{r}")
        pnum.Value = i + 1
        pnum.Font.Size = 9
        pnum.Font.Color = _rgb(*GRAY_MID)
        pnum.HorizontalAlignment = XL_HALIGN_CENTER
        pnum.Interior.Color = _rgb(*fill_color)

        # Input cells C, D, E, F
        for col in ["C", "D", "E", "F"]:
            cell = ws.Range(f"{col}{r}")
            cell.Interior.Color = _rgb(*INPUT_FILL)
            cell.Font.Size = 9
            for side in [XL_EDGE_TOP, XL_EDGE_BOTTOM,
                         XL_EDGE_LEFT, XL_EDGE_RIGHT]:
                cell.Borders(side).LineStyle = XL_CONTINUOUS
                cell.Borders(side).Weight = XL_THIN
                cell.Borders(side).Color = _rgb(200, 200, 215)

        ws.Rows(r).RowHeight = 15

    # Data validation on col F (bank station dropdown)
    ws.Range(f"F{XS_FIRST_DATA}:F{XS_FIRST_DATA + 49}").Validation.Delete()
    ws.Range(f"F{XS_FIRST_DATA}:F{XS_FIRST_DATA + 49}").Validation.Add(
        Type=XL_VALIDATE_LIST,
        Formula1="Left Bank,Right Bank,\u2014"
    )

    # Thin accent line after last XS row
    _thin_accent_border(ws, XS_FIRST_DATA + 49, "B", "F")

    # ── Row 57: spacer ────────────────────────────────────────────────────────
    _spacer_row(ws, 57, height=10)

    # ── Zone 2: Bridge Geometry ───────────────────────────────────────────────
    _banner_row(ws, 58, "  \u25a0  ZONE 2 \u2014 BRIDGE GEOMETRY",
                col_start="A", col_end="H", height=22)

    _sub_header_row(ws, 59, "Opening Dimensions", col_start="B", col_end="H")

    # Rows 60-67: bridge geometry label-value pairs (BRIDGE_START_ROW = 60)
    bridge_rows = [
        (60, "Low Chord Elevation  \u2014  Left",  "ft"),
        (61, "Low Chord Elevation  \u2014  Right", "ft"),
        (62, "High Chord Elevation",                "ft"),
        (63, None, None),                           # spacer
        (64, "Left Abutment Station",               "ft"),
        (65, "Right Abutment Station",              "ft"),
        (66, "Left Abutment Slope (H:V)",           ""),
        (67, "Skew Angle",                          "deg"),
    ]
    for row, label, units in bridge_rows:
        if label is None:
            _spacer_row(ws, row, height=5)
        else:
            _label_value_row(ws, row, label, units=units)

    _thin_accent_border(ws, 67, "B", "C")

    # ── Row 68: spacer ────────────────────────────────────────────────────────
    _spacer_row(ws, 68, height=8)

    # ── Sub-zone: Pier Data ───────────────────────────────────────────────────
    _sub_header_row(ws, 69, "Pier Data", col_start="B", col_end="H")

    _col_header_row(ws, PIER_HEADER_ROW, {
        "B": "Pier #",
        "C": "Station (ft)",
        "D": "Width (ft)",
        "E": "Shape",
    }, height=17)

    for i in range(10):
        r = PIER_FIRST_DATA + i
        fill_color = GRAY_ALT if i % 2 == 0 else WHITE

        pnum = ws.Range(f"B{r}")
        pnum.Value = i + 1
        pnum.Font.Size = 9
        pnum.Font.Color = _rgb(*GRAY_MID)
        pnum.HorizontalAlignment = XL_HALIGN_CENTER
        pnum.Interior.Color = _rgb(*fill_color)

        for col in ["C", "D", "E"]:
            cell = ws.Range(f"{col}{r}")
            cell.Interior.Color = _rgb(*INPUT_FILL)
            cell.Font.Size = 9
            for side in [XL_EDGE_TOP, XL_EDGE_BOTTOM,
                         XL_EDGE_LEFT, XL_EDGE_RIGHT]:
                cell.Borders(side).LineStyle = XL_CONTINUOUS
                cell.Borders(side).Weight = XL_THIN
                cell.Borders(side).Color = _rgb(200, 200, 215)

        ws.Rows(r).RowHeight = 15

    # Pier shape dropdown (col E = column 5)
    ws.Range(f"E{PIER_FIRST_DATA}:E{PIER_FIRST_DATA + 9}").Validation.Delete()
    ws.Range(f"E{PIER_FIRST_DATA}:E{PIER_FIRST_DATA + 9}").Validation.Add(
        Type=XL_VALIDATE_LIST,
        Formula1="Square,Round-nose,Cylindrical,Sharp"
    )

    _thin_accent_border(ws, PIER_FIRST_DATA + 9, "B", "E")

    # ── Row 81: spacer ────────────────────────────────────────────────────────
    _spacer_row(ws, 81, height=10)

    # ── Zone 3: Flow Profiles ─────────────────────────────────────────────────
    _banner_row(ws, 82, "  \u25a0  ZONE 3 \u2014 FLOW PROFILES",
                col_start="A", col_end="H", height=22)

    _col_header_row(ws, FLOW_HEADER_ROW, {
        "B": "Profile Name",
        "C": "Q (cfs)",
        "D": "DS WSEL (ft)",
        "E": "Slope (ft/ft)",
        "F": "Contr. Reach (ft)",
        "G": "Exp. Reach (ft)",
    }, height=17)

    for i in range(10):
        r = FLOW_FIRST_DATA + i
        fill_color = GRAY_ALT if i % 2 == 0 else WHITE

        for col in ["B", "C", "D", "E", "F", "G"]:
            cell = ws.Range(f"{col}{r}")
            cell.Interior.Color = _rgb(*INPUT_FILL)
            cell.Font.Size = 9
            for side in [XL_EDGE_TOP, XL_EDGE_BOTTOM,
                         XL_EDGE_LEFT, XL_EDGE_RIGHT]:
                cell.Borders(side).LineStyle = XL_CONTINUOUS
                cell.Borders(side).Weight = XL_THIN
                cell.Borders(side).Color = _rgb(200, 200, 215)

        ws.Rows(r).RowHeight = 15

    _thin_accent_border(ws, FLOW_FIRST_DATA + 9, "B", "G")

    # ── Row 94: spacer ────────────────────────────────────────────────────────
    _spacer_row(ws, 94, height=10)

    # ── Zone 4: Coefficients & Settings ──────────────────────────────────────
    _banner_row(ws, 95, "  \u25a0  ZONE 4 \u2014 COEFFICIENTS & SETTINGS",
                col_start="A", col_end="H", height=22)

    # COEFF_START_ROW = 96
    _sub_header_row(ws, COEFF_START_ROW, "Energy Method",
                    col_start="B", col_end="H")

    # Cc = COEFF_START_ROW + 1 = 97
    _label_value_row(ws, COEFF_START_ROW + 1, "Contraction Coeff  (Cc)",
                     default_val=0.3)
    # Ce = COEFF_START_ROW + 2 = 98
    _label_value_row(ws, COEFF_START_ROW + 2, "Expansion Coeff  (Ce)",
                     default_val=0.5)

    _spacer_row(ws, COEFF_START_ROW + 3, height=6)     # row 99

    # Yarnell sub-header (row 100)
    _sub_header_row(ws, COEFF_START_ROW + 4, "Yarnell Method",
                    col_start="B", col_end="H")
    # K override = COEFF_START_ROW + 5 = 101
    _label_value_row(ws, COEFF_START_ROW + 5,
                     "K Override  (blank = auto from shape)",
                     default_val="")

    _spacer_row(ws, COEFF_START_ROW + 6, height=6)     # row 102

    # Iteration sub-header (row 103)
    _sub_header_row(ws, COEFF_START_ROW + 7, "Iteration Settings",
                    col_start="B", col_end="H")
    # Max iter = COEFF_START_ROW + 8 = 104
    _label_value_row(ws, COEFF_START_ROW + 8, "Max Iterations",
                     default_val=100)
    # Tolerance = COEFF_START_ROW + 9 = 105
    _label_value_row(ws, COEFF_START_ROW + 9, "Tolerance (ft)",
                     default_val=0.01)
    # Guess offset = COEFF_START_ROW + 10 = 106
    _label_value_row(ws, COEFF_START_ROW + 10, "Initial Guess Offset (ft)",
                     default_val=0.5)

    _spacer_row(ws, COEFF_START_ROW + 11, height=8)    # row 107

    # Methods to Run (rows 108-109)
    _sub_header_row(ws, COEFF_START_ROW + 12, "Methods to Run",
                    col_start="B", col_end="H")   # row 108

    toggle_row = COEFF_START_ROW + 13  # row 109
    for col, method in [("C", "Energy"), ("D", "Momentum"),
                        ("E", "Yarnell"), ("F", "WSPRO")]:
        # label row
        lbl = ws.Range(f"{col}{COEFF_START_ROW + 12}")
        # (sub_header already merged over B:H, so just write toggle cells)

    # Write method name labels in row 108 overwriting the merged sub-header
    # We need individual cells for toggle labeling — use a row above toggles
    method_label_row = COEFF_START_ROW + 12
    toggle_row       = COEFF_START_ROW + 13

    # Unmerge and redo row 108 for multi-column method labels
    ws.Range(f"B{method_label_row}:H{method_label_row}").UnMerge()
    lbl0 = ws.Range(f"B{method_label_row}")
    lbl0.Value = "Methods to Run:"
    lbl0.Font.Bold = True
    lbl0.Font.Size = 9
    lbl0.Font.Color = _rgb(*GRAY_DARK)
    lbl0.Interior.Color = _rgb(*NAV_LIGHT)

    for col, method_name in [("C", "Energy"), ("D", "Momentum"),
                              ("E", "Yarnell"), ("F", "WSPRO")]:
        cell = ws.Range(f"{col}{method_label_row}")
        cell.Value = method_name
        cell.Font.Bold = True
        cell.Font.Size = 9
        cell.Font.Color = _rgb(*GRAY_DARK)
        cell.Interior.Color = _rgb(*NAV_LIGHT)
        cell.HorizontalAlignment = XL_HALIGN_CENTER

    # Toggle TRUE/FALSE row
    for col in ["C", "D", "E", "F"]:
        cell = ws.Range(f"{col}{toggle_row}")
        cell.Value = True
        cell.Font.Size = 9
        cell.HorizontalAlignment = XL_HALIGN_CENTER
        _input_cell(ws, f"{col}{toggle_row}")

    ws.Rows(method_label_row).RowHeight = 17
    ws.Rows(toggle_row).RowHeight = 16

    # ── Freeze panes at row 4 (keeps title + buttons visible) ────────────────
    ws.Activate()
    excel.ActiveWindow.FreezePanes = False
    ws.Range("A4").Select()
    excel.ActiveWindow.FreezePanes = True

    # ── Print area ────────────────────────────────────────────────────────────
    ws.PageSetup.PrintArea = f"A1:H{toggle_row + 2}"
    ws.PageSetup.FitToPagesWide = 1
    ws.PageSetup.FitToPagesTall = False
    ws.PageSetup.Orientation = 2   # xlLandscape


# ── Method sheets ──────────────────────────────────────────────────────────────

def format_method_sheet(wb, sheet_name):
    """Set up a calculation method sheet with a professional layout."""
    ws = wb.Sheets(sheet_name)

    ws.Tab.Color = _rgb(*NAV_MED)

    ws.Columns("A").ColumnWidth = 1.2
    ws.Columns("B").ColumnWidth = 28
    ws.Columns("C").ColumnWidth = 16
    ws.Columns("D").ColumnWidth = 16
    ws.Columns("E").ColumnWidth = 16
    ws.Columns("F").ColumnWidth = 16
    ws.Columns("G").ColumnWidth = 16

    # ── Row 1: method title bar ───────────────────────────────────────────────
    rng = ws.Range("A1:G1")
    rng.Merge()
    rng.Value = f"  {sheet_name.upper()}  \u2014  BRIDGE LOSS CALCULATION"
    rng.Font.Bold = True
    rng.Font.Size = 14
    rng.Font.Color = _rgb(*WHITE)
    rng.Interior.Color = _rgb(*NAV_DARK)
    ws.Rows(1).RowHeight = 32

    # ── Row 2: reference citation (populated by VBA at runtime) ───────────────
    rng = ws.Range("A2:G2")
    rng.Merge()
    rng.Value = "Reference: [populated at runtime]"
    rng.Font.Italic = True
    rng.Font.Size = 9
    rng.Font.Color = _rgb(*GRAY_MID)
    rng.Interior.Color = _rgb(236, 240, 246)
    ws.Rows(2).RowHeight = 16

    # ── Row 3: governing equation placeholder ─────────────────────────────────
    rng = ws.Range("A3:G3")
    rng.Merge()
    rng.Value = "Equation: [populated at runtime]"
    rng.Font.Italic = True
    rng.Font.Size = 9
    rng.Font.Color = _rgb(*GRAY_MID)
    rng.Interior.Color = _rgb(248, 250, 252)
    ws.Rows(3).RowHeight = 16

    _spacer_row(ws, 4, height=8)

    # ── Section banners (content populated by VBA) ────────────────────────────
    for row, title in [
        (5,  "  INPUT ECHO"),
        (15, "  CALCULATIONS"),
        (30, "  ITERATION LOG"),
        (50, "  RESULTS"),
    ]:
        _banner_row(ws, row, title, col_start="A", col_end="G",
                    bg=NAV_MED, height=20)
        ws.Range(f"B{row + 1}").Value = "[populated at runtime]"
        ws.Range(f"B{row + 1}").Font.Italic = True
        ws.Range(f"B{row + 1}").Font.Color = _rgb(*GRAY_MID)


# ── Summary sheet ──────────────────────────────────────────────────────────────

def format_summary_sheet(wb):
    """Set up the Summary & Charts sheet with a professional layout."""
    ws = wb.Sheets("Summary & Charts")

    ws.Tab.Color = _rgb(34, 120, 60)  # green tab

    ws.Columns("A").ColumnWidth = 1.2
    ws.Columns("B").ColumnWidth = 22
    ws.Columns("C").ColumnWidth = 14
    ws.Columns("D").ColumnWidth = 14
    ws.Columns("E").ColumnWidth = 14
    ws.Columns("F").ColumnWidth = 14
    ws.Columns("G").ColumnWidth = 14

    # ── Row 1: title bar ──────────────────────────────────────────────────────
    rng = ws.Range("A1:G1")
    rng.Merge()
    rng.Value = "  BRIDGE LOSS CALCULATION  \u2014  SUMMARY OF RESULTS"
    rng.Font.Bold = True
    rng.Font.Size = 14
    rng.Font.Color = _rgb(*WHITE)
    rng.Interior.Color = _rgb(*NAV_DARK)
    ws.Rows(1).RowHeight = 32

    # ── Row 2: subtitle ───────────────────────────────────────────────────────
    rng = ws.Range("A2:G2")
    rng.Merge()
    rng.Value = "    Results populated by VBA at runtime"
    rng.Font.Italic = True
    rng.Font.Size = 9
    rng.Font.Color = _rgb(*GRAY_MID)
    rng.Interior.Color = _rgb(236, 240, 246)
    ws.Rows(2).RowHeight = 16

    _spacer_row(ws, 3, height=8)

    # ── Results table placeholder ─────────────────────────────────────────────
    _banner_row(ws, 4, "  UPSTREAM WSEL SUMMARY  (ft)",
                col_start="A", col_end="G", bg=NAV_MED, height=20)

    # Column headers
    _col_header_row(ws, 5, {
        "B": "Profile",
        "C": "Energy",
        "D": "Momentum",
        "E": "Yarnell",
        "F": "WSPRO",
        "G": "HEC-RAS",
    }, height=17)

    # Placeholder data rows (10)
    hecras_gold = (255, 217, 102)
    for i in range(10):
        r = 6 + i
        fill = GRAY_ALT if i % 2 == 0 else WHITE
        for col in ["B", "C", "D", "E", "F"]:
            cell = ws.Range(f"{col}{r}")
            cell.Interior.Color = _rgb(*fill)
            cell.Font.Size = 9
        # HEC-RAS column always gold
        cell_g = ws.Range(f"G{r}")
        cell_g.Interior.Color = _rgb(*hecras_gold)
        cell_g.Font.Size = 9
        ws.Rows(r).RowHeight = 15

    _thin_accent_border(ws, 15, "B", "G")

    _spacer_row(ws, 16, height=10)

    # ── Loss table placeholder ────────────────────────────────────────────────
    _banner_row(ws, 17, "  HEAD LOSS SUMMARY  (ft)",
                col_start="A", col_end="G", bg=NAV_MED, height=20)
    _col_header_row(ws, 18, {
        "B": "Profile",
        "C": "Energy",
        "D": "Momentum",
        "E": "Yarnell",
        "F": "WSPRO",
    }, height=17)
    for i in range(10):
        r = 19 + i
        fill = GRAY_ALT if i % 2 == 0 else WHITE
        for col in ["B", "C", "D", "E", "F"]:
            cell = ws.Range(f"{col}{r}")
            cell.Interior.Color = _rgb(*fill)
            cell.Font.Size = 9
        ws.Rows(r).RowHeight = 15


# ── Instructions sheet ─────────────────────────────────────────────────────────

def format_instructions_sheet(wb):
    """Set up the Instructions sheet with clean, readable layout."""
    ws = wb.Sheets("Instructions")

    ws.Tab.Color = _rgb(120, 120, 130)  # gray tab

    ws.Columns("A").ColumnWidth = 1.2
    ws.Columns("B").ColumnWidth = 4     # step-number column
    ws.Columns("C").ColumnWidth = 80    # text column
    ws.Columns("D").ColumnWidth = 4

    # ── Row 1: title bar ──────────────────────────────────────────────────────
    rng = ws.Range("A1:D1")
    rng.Merge()
    rng.Value = "  BRIDGE LOSS CALCULATOR  \u2014  Instructions & Reference"
    rng.Font.Bold = True
    rng.Font.Size = 14
    rng.Font.Color = _rgb(*WHITE)
    rng.Interior.Color = _rgb(*NAV_DARK)
    ws.Rows(1).RowHeight = 32

    # ── Row 2: subtitle ───────────────────────────────────────────────────────
    rng = ws.Range("A2:D2")
    rng.Merge()
    rng.Value = "    Four-method hydraulic analysis: Energy \u2022 Momentum \u2022 Yarnell \u2022 WSPRO"
    rng.Font.Italic = True
    rng.Font.Size = 9
    rng.Font.Color = _rgb(*GRAY_MID)
    rng.Interior.Color = _rgb(236, 240, 246)
    ws.Rows(2).RowHeight = 16

    _spacer_row(ws, 3, height=10)

    # ── PURPOSE ───────────────────────────────────────────────────────────────
    _banner_row(ws, 4, "  PURPOSE", col_start="A", col_end="D",
                bg=NAV_MED, height=20)

    purpose_text = (
        "This tool computes bridge hydraulic losses using four methods: "
        "Energy (Standard Step), Momentum, Yarnell, and WSPRO. "
        "Each method is solved iteratively to determine the upstream water "
        "surface elevation (WSEL). Results can be compared against HEC-RAS "
        "output on the Summary & Charts sheet."
    )
    cell = ws.Range("C5")
    cell.Value = purpose_text
    cell.WrapText = True
    cell.Font.Size = 9
    cell.Font.Color = _rgb(*GRAY_DARK)
    ws.Rows(5).RowHeight = 42

    _spacer_row(ws, 6, height=8)

    # ── HOW TO USE ────────────────────────────────────────────────────────────
    _banner_row(ws, 7, "  HOW TO USE", col_start="A", col_end="D",
                bg=NAV_MED, height=20)

    steps = [
        "Enter the river cross-section data (station, elevation, Manning\u2019s n, "
        "bank stations) in Zone 1 of the Input sheet. Up to 50 points supported.",

        "Enter bridge geometry in Zone 2: low/high chord elevations, abutment "
        "stations, abutment slope, and skew angle.",

        "Enter pier data in the Pier Data sub-table: station, width, and shape "
        "for each pier (up to 10 piers).",

        "Enter flow profile data in Zone 3: profile name, discharge (Q), "
        "downstream WSEL, energy slope, contraction reach, and expansion reach.",

        "Adjust coefficients and settings in Zone 4 if needed. "
        "Default values (Cc\u202f=\u202f0.3, Ce\u202f=\u202f0.5) are standard for most applications.",

        "Select which methods to run using the TRUE/FALSE toggles in the "
        "\u2018Methods to Run\u2019 row.",

        "Click \u2018Run All Methods\u2019 to execute the calculations.",

        "View individual method results on the Energy Method, Momentum Method, "
        "Yarnell, and WSPRO sheets.",

        "Click \u2018Generate Charts\u2019 to create profile plots on the Summary & Charts sheet.",

        "Click \u2018Plot Cross-Section\u2019 to plot the channel cross-section geometry.",

        "Click \u2018Clear Results\u2019 to reset all calculated output before a new run.",

        "Save the workbook to preserve inputs and results.",
    ]

    for i, step in enumerate(steps):
        r = 8 + i
        # Step number (bold colored)
        num_cell = ws.Range(f"B{r}")
        num_cell.Value = f"{i + 1}."
        num_cell.Font.Bold = True
        num_cell.Font.Size = 9
        num_cell.Font.Color = _rgb(*NAV_MED)
        num_cell.HorizontalAlignment = XL_HALIGN_RIGHT

        # Step text
        txt_cell = ws.Range(f"C{r}")
        txt_cell.Value = step
        txt_cell.WrapText = True
        txt_cell.Font.Size = 9
        txt_cell.Font.Color = _rgb(*GRAY_DARK)

        # Alternating row background
        fill = GRAY_ALT if i % 2 == 0 else WHITE
        ws.Range(f"B{r}:C{r}").Interior.Color = _rgb(*fill)
        ws.Rows(r).RowHeight = 28

    _spacer_row(ws, 8 + len(steps), height=10)

    # ── METHODS ───────────────────────────────────────────────────────────────
    methods_row = 8 + len(steps) + 1
    _banner_row(ws, methods_row, "  CALCULATION METHODS",
                col_start="A", col_end="D", bg=NAV_MED, height=20)

    method_descriptions = [
        ("Energy Method",
         "Applies the standard step energy equation through the bridge opening. "
         "Uses contraction (Cc) and expansion (Ce) loss coefficients to account "
         "for velocity head changes."),
        ("Momentum Method",
         "Applies the momentum equation across the bridge reach. "
         "Accounts for hydrostatic pressure forces on piers and abutments."),
        ("Yarnell Method",
         "Empirical method based on Yarnell\u2019s 1934 laboratory experiments. "
         "Uses a K factor based on pier shape to compute backwater through the opening."),
        ("WSPRO Method",
         "Based on the FHWA WSPRO model. Uses a projected discharge approach "
         "through the bridge waterway to compute the upstream WSEL."),
    ]

    for i, (mname, mdesc) in enumerate(method_descriptions):
        r = methods_row + 1 + i
        name_cell = ws.Range(f"B{r}")
        name_cell.Value = mname
        name_cell.Font.Bold = True
        name_cell.Font.Size = 9
        name_cell.Font.Color = _rgb(*NAV_DARK)
        name_cell.VerticalAlignment = -4160  # xlTop

        desc_cell = ws.Range(f"C{r}")
        desc_cell.Value = mdesc
        desc_cell.WrapText = True
        desc_cell.Font.Size = 9
        desc_cell.Font.Color = _rgb(*GRAY_DARK)

        fill = GRAY_ALT if i % 2 == 0 else WHITE
        ws.Range(f"B{r}:C{r}").Interior.Color = _rgb(*fill)
        ws.Rows(r).RowHeight = 36

    notes_row = methods_row + 1 + len(method_descriptions) + 1
    _spacer_row(ws, notes_row - 1, height=10)

    # ── NOTES ─────────────────────────────────────────────────────────────────
    _banner_row(ws, notes_row, "  NOTES & LIMITATIONS",
                col_start="A", col_end="D", bg=NAV_MED, height=20)

    notes = [
        "All calculations assume steady, gradually varied flow conditions.",
        "The cross-section must include at least one Left Bank and one Right Bank station.",
        "Manning\u2019s n values should be assigned to each cross-section point; "
        "values are averaged over sub-areas.",
        "Pier shapes: Square (K\u202f=\u202f1.25), Round-nose (K\u202f=\u202f0.9), "
        "Cylindrical (K\u202f=\u202f1.05), Sharp (K\u202f=\u202f0.9).",
        "The Yarnell K Override allows a custom K value; leave blank to use the "
        "shape-based default.",
        "Iteration settings control solver convergence; defaults are suitable for "
        "most applications.",
        "Results on method sheets are overwritten each time \u2018Run All Methods\u2019 is clicked.",
    ]

    for i, note in enumerate(notes):
        r = notes_row + 1 + i
        bullet = ws.Range(f"B{r}")
        bullet.Value = "\u2022"
        bullet.Font.Bold = True
        bullet.Font.Size = 10
        bullet.Font.Color = _rgb(*NAV_MED)
        bullet.HorizontalAlignment = XL_HALIGN_CENTER

        note_cell = ws.Range(f"C{r}")
        note_cell.Value = note
        note_cell.WrapText = True
        note_cell.Font.Size = 9
        note_cell.Font.Color = _rgb(*GRAY_DARK)

        fill = GRAY_ALT if i % 2 == 0 else WHITE
        ws.Range(f"B{r}:C{r}").Interior.Color = _rgb(*fill)
        ws.Rows(r).RowHeight = 24


# ── Buttons ────────────────────────────────────────────────────────────────────

def add_buttons(wb):
    """Add action buttons to the Input sheet (positioned in row 3)."""
    ws = wb.Sheets("Input")

    # (label, macro_name, left, top, width, height)
    # Row 3 is at ~36+18 = 54 pts from top; center vertically in 32-pt row
    buttons = [
        ("Run All Methods",    "RunAllMethods",     10,  57, 130, 26),
        ("Generate Charts",    "GenerateChartsBtn", 150, 57, 120, 26),
        ("Clear Results",      "ClearResults",      280, 57, 110, 26),
        ("Plot Cross-Section", "PlotCrossSection",  400, 57, 130, 26),
    ]

    for label, macro, left, top, width, height in buttons:
        # msoShapeRoundedRectangle = 5
        shp = ws.Shapes.AddShape(5,
                                 float(left), float(top),
                                 float(width), float(height))
        shp.TextFrame.Characters().Text = label
        shp.TextFrame.Characters().Font.Bold = True
        shp.TextFrame.Characters().Font.Size = 9
        shp.TextFrame.HorizontalAlignment = -4108   # xlCenter
        shp.TextFrame.VerticalAlignment   = -4108   # xlCenter
        shp.OnAction = macro
        shp.Fill.ForeColor.RGB = _rgb(*NAV_DARK)
        shp.TextFrame.Characters().Font.Color = _rgb(*WHITE)
        shp.Line.Visible = False


# ── Main build ─────────────────────────────────────────────────────────────────

def build():
    """Main build process."""
    print("Building BridgeLossCalculator.xlsm...")

    print("1. Creating workbook...")
    excel, wb = create_workbook()

    try:
        print("2. Importing VBA modules...")
        import_vba_modules(wb)

        print("3. Formatting Input sheet...")
        format_input_sheet(wb, excel)

        print("4. Formatting method sheets...")
        for name in ["Energy Method", "Momentum Method", "Yarnell", "WSPRO"]:
            format_method_sheet(wb, name)

        print("5. Formatting Summary & Charts sheet...")
        format_summary_sheet(wb)

        print("6. Formatting Instructions sheet...")
        format_instructions_sheet(wb)

        print("7. Adding buttons...")
        add_buttons(wb)

        print("8. Saving...")
        wb.SaveAs(OUTPUT_PATH, FileFormat=XL_MACRO_ENABLED)
        print(f"Done! Saved to {OUTPUT_PATH}")

    finally:
        wb.Close(SaveChanges=False)
        excel.Quit()


if __name__ == "__main__":
    build()
