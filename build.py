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
    ws.Range("A1").Value = "INPUT SHEET — to be formatted by build"


def format_method_sheet(wb, sheet_name):
    """Set up a calculation method sheet with common layout."""
    ws = wb.Sheets(sheet_name)
    ws.Range("A1").Value = f"{sheet_name.upper()} — to be formatted by build"


def format_summary_sheet(wb):
    """Set up the Summary & Charts sheet."""
    ws = wb.Sheets("Summary & Charts")
    ws.Range("A1").Value = "SUMMARY — to be formatted by build"


def format_instructions_sheet(wb):
    """Set up the Instructions sheet."""
    ws = wb.Sheets("Instructions")
    ws.Range("A1").Value = "INSTRUCTIONS — to be formatted by build"


def add_buttons(wb):
    """Add action buttons to the Input sheet."""
    pass


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
