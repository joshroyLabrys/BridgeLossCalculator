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
XL_MACRO_ENABLED = 52  # xlOpenXMLWorkbookMacroEnabled
XL_VALIDATE_LIST = 3   # xlValidateList
XL_EDGE_BOTTOM = 9     # xlEdgeBottom
XL_CONTINUOUS = 1      # xlContinuous


def _rgb(r, g, b):
    """Convert RGB values to Excel COM color integer (BGR order)."""
    return r + g * 256 + b * 65536


def create_workbook():
    """Create a new Excel workbook with all sheets."""
    excel = win32.gencache.EnsureDispatch("Excel.Application")
    excel.Visible = False
    excel.DisplayAlerts = False
    wb = excel.Workbooks.Add()

    # Rename Sheet1 and add remaining sheets
    sheet_names = [
        "Instructions",
        "Input",
        "Energy Method",
        "Momentum Method",
        "Yarnell",
        "WSPRO",
        "Summary & Charts",
    ]

    # Delete extra default sheets, keep one
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


def format_input_sheet(wb):
    """Set up the Input sheet layout, formatting, and data validation."""
    ws = wb.Sheets("Input")

    # ------------------------------------------------------------------ #
    # Zone 1: River Cross-Section (rows 3-25)                             #
    # ------------------------------------------------------------------ #

    # Row 3 header — merged A3:E3
    ws.Range("A3:E3").Merge()
    cell = ws.Range("A3")
    cell.Value = "RIVER CROSS-SECTION"
    cell.Font.Bold = True
    cell.Font.Size = 12
    cell.Interior.Color = _rgb(198, 224, 180)  # light green

    # Row 4 column headers
    headers_zone1 = {
        "A4": "Point #",
        "B4": "Station (ft)",
        "C4": "Elevation (ft)",
        "D4": "Manning's n",
        "E4": "Bank Station?",
    }
    for addr, label in headers_zone1.items():
        cell = ws.Range(addr)
        cell.Value = label
        cell.Font.Bold = True
        cell.Borders(XL_EDGE_BOTTOM).LineStyle = XL_CONTINUOUS
        cell.Interior.Color = _rgb(217, 217, 217)  # light grey

    # Column widths
    ws.Columns("A").ColumnWidth = 8
    ws.Columns("B").ColumnWidth = 14
    ws.Columns("C").ColumnWidth = 14
    ws.Columns("D").ColumnWidth = 12
    ws.Columns("E").ColumnWidth = 14

    # Data validation on column E (rows 5-54) — dropdown
    ws.Range("E5:E54").Validation.Delete()
    ws.Range("E5:E54").Validation.Add(
        Type=XL_VALIDATE_LIST,
        Formula1="Left Bank,Right Bank,\u2014"
    )

    # ------------------------------------------------------------------ #
    # Zone 2: Bridge Geometry (rows 28-55)                                #
    # ------------------------------------------------------------------ #

    # Row 28 header
    cell = ws.Range("A28")
    cell.Value = "BRIDGE GEOMETRY"
    cell.Font.Bold = True
    cell.Font.Size = 12
    cell.Interior.Color = _rgb(189, 215, 238)  # light blue

    bridge_labels = {
        "A29": "Low Chord Elev (Left) ft",
        "A30": "Low Chord Elev (Right) ft",
        "A31": "High Chord Elev ft",
        # row 32 intentionally blank
        "A33": "Left Abutment Station ft",
        "A34": "Right Abutment Station ft",
        "A35": "Left Abutment Slope (H:V)",
        "A36": "Skew Angle (deg)",
    }
    for addr, label in bridge_labels.items():
        ws.Range(addr).Value = label

    # Row 39: PIER DATA sub-header
    cell = ws.Range("A39")
    cell.Value = "PIER DATA"
    cell.Font.Bold = True
    cell.Interior.Color = _rgb(189, 215, 238)

    # Row 40: pier column headers
    pier_headers = {
        "A40": "Pier #",
        "B40": "Station (ft)",
        "C40": "Width (ft)",
        "D40": "Shape",
    }
    for addr, label in pier_headers.items():
        cell = ws.Range(addr)
        cell.Value = label
        cell.Font.Bold = True
        cell.Borders(XL_EDGE_BOTTOM).LineStyle = XL_CONTINUOUS
        cell.Interior.Color = _rgb(217, 217, 217)

    # Data validation on column D (rows 41-50) — pier shape dropdown
    ws.Range("D41:D50").Validation.Delete()
    ws.Range("D41:D50").Validation.Add(
        Type=XL_VALIDATE_LIST,
        Formula1="Square,Round-nose,Cylindrical,Sharp"
    )

    # ------------------------------------------------------------------ #
    # Zone 3: Flow Profiles (rows 58-72)                                  #
    # ------------------------------------------------------------------ #

    # Row 58 header
    cell = ws.Range("A58")
    cell.Value = "FLOW PROFILES"
    cell.Font.Bold = True
    cell.Font.Size = 12
    cell.Interior.Color = _rgb(255, 235, 156)  # light yellow

    # Row 59: column headers
    flow_headers = {
        "A59": "Profile Name",
        "B59": "Q (cfs)",
        "C59": "DS WSEL (ft)",
        "D59": "Slope (ft/ft)",
        "E59": "Contr. Reach (ft)",
        "F59": "Exp. Reach (ft)",
    }
    for addr, label in flow_headers.items():
        cell = ws.Range(addr)
        cell.Value = label
        cell.Font.Bold = True
        cell.Borders(XL_EDGE_BOTTOM).LineStyle = XL_CONTINUOUS
        cell.Interior.Color = _rgb(217, 217, 217)

    ws.Columns("F").ColumnWidth = 14

    # ------------------------------------------------------------------ #
    # Zone 4: Coefficients & Settings (rows 75-90)                        #
    # ------------------------------------------------------------------ #

    # Row 75 header
    cell = ws.Range("A75")
    cell.Value = "COEFFICIENTS & SETTINGS"
    cell.Font.Bold = True
    cell.Font.Size = 12
    cell.Interior.Color = _rgb(226, 239, 218)  # pale green

    # Energy method defaults
    ws.Range("A77").Value = "Cc:"
    ws.Range("B77").Value = 0.3
    ws.Range("A78").Value = "Ce:"
    ws.Range("B78").Value = 0.5

    # Yarnell
    ws.Range("A80").Value = "Yarnell K Override:"
    ws.Range("B80").Value = ""

    # Iteration settings
    ws.Range("A83").Value = "Max Iterations:"
    ws.Range("B83").Value = 100
    ws.Range("A84").Value = "Tolerance (ft):"
    ws.Range("B84").Value = 0.01
    ws.Range("A85").Value = "Initial Guess Offset (ft):"
    ws.Range("B85").Value = 0.5

    # Methods to run — row 87 labels, row 88 TRUE/FALSE toggles
    ws.Range("B87").Value = "Energy"
    ws.Range("C87").Value = "Momentum"
    ws.Range("D87").Value = "Yarnell"
    ws.Range("E87").Value = "WSPRO"
    ws.Range("A87").Value = "Methods to Run:"
    ws.Range("A87").Font.Bold = True

    ws.Range("B88").Value = True
    ws.Range("C88").Value = True
    ws.Range("D88").Value = True
    ws.Range("E88").Value = True


def format_method_sheet(wb, sheet_name):
    """Set up a calculation method sheet with common layout."""
    ws = wb.Sheets(sheet_name)

    # Row 1: sheet title
    cell = ws.Range("A1")
    cell.Value = sheet_name
    cell.Font.Bold = True
    cell.Font.Size = 14
    cell.Interior.Color = _rgb(189, 215, 238)  # light blue

    # Row 2: reference placeholder (populated by VBA at runtime)
    ws.Range("A2").Value = "[Reference — populated at runtime]"
    ws.Range("A2").Font.Italic = True
    ws.Range("A2").Font.Color = _rgb(128, 128, 128)

    # Row 3: equation placeholder (populated by VBA at runtime)
    ws.Range("A3").Value = "[Equation — populated at runtime]"
    ws.Range("A3").Font.Italic = True
    ws.Range("A3").Font.Color = _rgb(128, 128, 128)


def format_summary_sheet(wb):
    """Set up the Summary & Charts sheet."""
    ws = wb.Sheets("Summary & Charts")

    # Row 1: title
    cell = ws.Range("A1")
    cell.Value = "BRIDGE LOSS CALCULATION SUMMARY"
    cell.Font.Bold = True
    cell.Font.Size = 16
    cell.Interior.Color = _rgb(189, 215, 238)

    # Remaining content populated by VBA at runtime
    ws.Range("A3").Value = "[Results populated by VBA at runtime]"
    ws.Range("A3").Font.Italic = True
    ws.Range("A3").Font.Color = _rgb(128, 128, 128)


def format_instructions_sheet(wb):
    """Set up the Instructions sheet."""
    ws = wb.Sheets("Instructions")

    # Row 1: title
    cell = ws.Range("A1")
    cell.Value = "BRIDGE LOSS CALCULATOR \u2014 Instructions"
    cell.Font.Bold = True
    cell.Font.Size = 16
    cell.Interior.Color = _rgb(189, 215, 238)

    # Section: PURPOSE
    ws.Range("A3").Value = "PURPOSE"
    ws.Range("A3").Font.Bold = True
    ws.Range("A3").Font.Size = 12

    ws.Range("A4").Value = (
        "This tool computes bridge hydraulic losses using four methods: "
        "Energy (Standard Step), Momentum, Yarnell, and WSPRO. "
        "Each method is solved iteratively to determine the upstream water surface elevation."
    )
    ws.Range("A4").WrapText = True

    # Section: HOW TO USE
    ws.Range("A6").Value = "HOW TO USE"
    ws.Range("A6").Font.Bold = True
    ws.Range("A6").Font.Size = 12

    steps = [
        "1. On the Input sheet, enter the river cross-section data (station, elevation, Manning's n, bank stations) in Zone 1.",
        "2. Enter bridge geometry in Zone 2: low/high chord elevations, abutment stations, slopes, skew angle.",
        "3. Enter pier data (station, width, shape) in the Pier Data table.",
        "4. Enter flow profile data in Zone 3: profile name, discharge (Q), downstream WSEL, energy slope, and reach lengths.",
        "5. Adjust coefficients and settings in Zone 4 if needed (defaults are standard values).",
        "6. Select which methods to run using the checkboxes in the Methods to Run row.",
        "7. Click 'Run All Methods' to execute the calculations.",
        "8. View individual method results on the Energy Method, Momentum Method, Yarnell, and WSPRO sheets.",
        "9. Click 'Generate Charts' to create cross-section and profile plots on the Summary & Charts sheet.",
        "10. Click 'Plot Cross-Section' to plot the channel cross-section geometry.",
        "11. Click 'Clear Results' to reset all calculated output cells before a new run.",
        "12. Save the workbook to preserve your inputs and results.",
    ]
    for i, step in enumerate(steps):
        ws.Range(f"A{7 + i}").Value = step
        ws.Range(f"A{7 + i}").WrapText = True

    # Section: METHODS
    ws.Range("A20").Value = "METHODS"
    ws.Range("A20").Font.Bold = True
    ws.Range("A20").Font.Size = 12

    methods = [
        "Energy Method: Applies the standard step energy equation through the bridge opening. "
        "Uses contraction (Cc) and expansion (Ce) loss coefficients.",
        "Momentum Method: Applies the momentum equation across the bridge reach. "
        "Accounts for pressure forces on piers and abutments.",
        "Yarnell Method: Empirical method based on Yarnell's 1934 experiments. "
        "Uses a K factor based on pier shape to compute backwater.",
        "WSPRO Method: Based on the FHWA WSPRO model. "
        "Uses a projected discharge approach through the bridge waterway.",
    ]
    for i, desc in enumerate(methods):
        ws.Range(f"A{21 + i}").Value = desc
        ws.Range(f"A{21 + i}").WrapText = True

    # Section: NOTES
    ws.Range("A26").Value = "NOTES"
    ws.Range("A26").Font.Bold = True
    ws.Range("A26").Font.Size = 12

    notes = [
        "All calculations assume steady, gradually varied flow conditions.",
        "The cross-section must include at least one Left Bank and one Right Bank station.",
        "Manning's n values should be assigned to each cross-section point; values are averaged over sub-areas.",
        "Pier shapes: Square (K=1.25), Round-nose (K=0.9), Cylindrical (K=1.05), Sharp (K=0.9).",
        "The Yarnell K Override allows a custom K value; leave blank to use the shape-based default.",
        "Iteration settings control solver convergence; defaults are suitable for most applications.",
        "Results on method sheets are overwritten each time 'Run All Methods' is clicked.",
    ]
    for i, note in enumerate(notes):
        ws.Range(f"A{27 + i}").Value = note
        ws.Range(f"A{27 + i}").WrapText = True

    # Widen column A for readability
    ws.Columns("A").ColumnWidth = 90


def add_buttons(wb):
    """Add action buttons to the Input sheet."""
    ws = wb.Sheets("Input")

    # Button definitions: (label, macro_name, left, top, width, height)
    buttons = [
        ("Run All Methods",   "RunAllMethods",     10,  5, 130, 28),
        ("Generate Charts",   "GenerateChartsBtn", 150, 5, 120, 28),
        ("Clear Results",     "ClearResults",      280, 5, 110, 28),
        ("Plot Cross-Section","PlotCrossSection",  400, 5, 130, 28),
    ]

    # msoShapeRoundedRectangle = 5
    for label, macro, left, top, width, height in buttons:
        shp = ws.Shapes.AddShape(5, float(left), float(top), float(width), float(height))
        shp.TextFrame.Characters().Text = label
        shp.TextFrame.Characters().Font.Bold = True
        shp.TextFrame.Characters().Font.Size = 9
        shp.TextFrame.HorizontalAlignment = -4108  # xlCenter
        shp.TextFrame.VerticalAlignment = -4108     # xlCenter
        shp.OnAction = macro
        # Style: dark fill, white text
        shp.Fill.ForeColor.RGB = _rgb(44, 62, 80)
        shp.TextFrame.Characters().Font.Color = _rgb(255, 255, 255)
        shp.Line.Visible = False


def build():
    """Main build process."""
    print("Building BridgeLossCalculator.xlsm...")

    print("1. Creating workbook...")
    excel, wb = create_workbook()

    try:
        print("2. Importing VBA modules...")
        import_vba_modules(wb)

        print("3. Formatting Input sheet...")
        format_input_sheet(wb)

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
