Attribute VB_Name = "mod_Main"
Option Explicit

' =============================================================================
' mod_Main.bas
' Main Orchestration for Bridge Loss Calculator
'
' Provides the top-level button handlers that drive the full calculation
' workflow: validation, method dispatch, summary generation, chart creation,
' and results clearing.
'
' Sheet names used across the workbook:
'   "Input"          — user inputs
'   "Energy Method"  — Energy method calculations
'   "Momentum Method"— Momentum method calculations
'   "Yarnell"        — Yarnell method calculations
'   "WSPRO"          — WSPRO method calculations
'   "Summary"        — Consolidated results summary
' =============================================================================

' Method sheet names — used by both RunAllMethods and PopulateSummary
Private Const SHEET_ENERGY   As String = "Energy Method"
Private Const SHEET_MOMENTUM As String = "Momentum Method"
Private Const SHEET_YARNELL  As String = "Yarnell"
Private Const SHEET_WSPRO    As String = "WSPRO"
Private Const SHEET_SUMMARY  As String = "Summary & Charts"
Private Const SHEET_INPUT    As String = "Input"

' Results block layout (shared by all method modules, rows 77-86)
Private Const RES_ROW_HEADER   As Long = 77   ' "RESULTS" label
Private Const RES_ROW_PROFILE  As Long = 78   ' Profile names
Private Const RES_ROW_WSEL     As Long = 79   ' US WSEL (ft)
Private Const RES_ROW_LOSS     As Long = 80   ' Head Loss (ft)
Private Const RES_ROW_REGIME   As Long = 84   ' Flow Regime
Private Const RES_ROW_PIER_FLC As Long = 85   ' TUFLOW Pier FLC
Private Const RES_ROW_SUPER_FLC As Long = 86  ' TUFLOW Super FLC

' Gold highlight colour used for HEC-RAS reference rows
Private Const COLOR_GOLD As Long = 16769408   ' RGB(255, 223, 128)

' Checkbox row on the Input sheet
Private Const CHECKBOX_ROW As Long = 109

' =============================================================================
' RunAllMethods
'
' Main button handler.  Validates inputs, determines which methods are
' selected via checkboxes in Input row 88 (columns 2-5), runs each selected
' method, then calls PopulateSummary to build the consolidated results table.
'
' Checkbox column mapping (row 88):
'   Col 2 = Energy Method
'   Col 3 = Momentum Method
'   Col 4 = Yarnell
'   Col 5 = WSPRO
'
' If none of the checkboxes is TRUE the routine runs all four methods.
' =============================================================================
Public Sub RunAllMethods()

    Dim wb As Object
    Set wb = ThisWorkbook

    ' --- Performance guards ---
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    On Error GoTo ErrHandler

    ' --- Validate inputs first ---
    Dim validMsg As String
    validMsg = ValidateInputs(wb.Sheets(SHEET_INPUT))
    If Len(validMsg) > 0 Then
        Application.ScreenUpdating = True
        Application.Calculation = xlCalculationAutomatic
        MsgBox "Input validation failed:" & vbNewLine & vbNewLine & validMsg, _
               vbExclamation, "Bridge Loss Calculator"
        Exit Sub
    End If

    ' --- Read method checkboxes (Input row 88, cols 2-5) ---
    Dim wsInput As Object
    Set wsInput = wb.Sheets(SHEET_INPUT)

    Dim runEnergy   As Boolean
    Dim runMomentum As Boolean
    Dim runYarnell  As Boolean
    Dim runWSPRO    As Boolean

    runEnergy   = GetCheckboxValue(wsInput, CHECKBOX_ROW, 3)   ' Col C
    runMomentum = GetCheckboxValue(wsInput, CHECKBOX_ROW, 4)   ' Col D
    runYarnell  = GetCheckboxValue(wsInput, CHECKBOX_ROW, 5)   ' Col E
    runWSPRO    = GetCheckboxValue(wsInput, CHECKBOX_ROW, 6)   ' Col F

    ' If none selected, run all
    If Not (runEnergy Or runMomentum Or runYarnell Or runWSPRO) Then
        runEnergy   = True
        runMomentum = True
        runYarnell  = True
        runWSPRO    = True
    End If

    ' --- Run selected methods ---
    If runEnergy Then
        Application.StatusBar = "Running Energy Method..."
        Call RunEnergy(wb)
    End If

    If runMomentum Then
        Application.StatusBar = "Running Momentum Method..."
        Call RunMomentum(wb)
    End If

    If runYarnell Then
        Application.StatusBar = "Running Yarnell Method..."
        Call RunYarnell(wb)
    End If

    If runWSPRO Then
        Application.StatusBar = "Running WSPRO Method..."
        Call RunWSPRO(wb)
    End If

    ' --- Build summary ---
    Application.StatusBar = "Building Summary..."
    Call PopulateSummary(wb)

    ' --- Restore application state ---
    Application.StatusBar = False
    Application.ScreenUpdating = True
    Application.Calculation = xlCalculationAutomatic

    MsgBox "All calculations complete.", vbInformation, "Bridge Loss Calculator"
    Exit Sub

ErrHandler:
    Application.StatusBar = False
    Application.ScreenUpdating = True
    Application.Calculation = xlCalculationAutomatic
    MsgBox "An error occurred during calculation:" & vbNewLine & vbNewLine & _
           Err.Description, vbCritical, "Bridge Loss Calculator"

End Sub

' =============================================================================
' ClearResults
'
' Prompts the user for confirmation, then clears:
'   A22:Z200 and A77:Z90 on all four method sheets
'   A22:Z200 and A77:Z90 on the Summary sheet
' Also deletes all chart objects embedded on the Summary sheet.
' =============================================================================
Public Sub ClearResults()

    Dim answer As VbMsgBoxResult
    answer = MsgBox("This will clear all calculation results and charts." & _
                    vbNewLine & "Are you sure?", _
                    vbQuestion Or vbYesNo, "Clear Results")

    If answer <> vbYes Then Exit Sub

    Dim wb As Object
    Set wb = ThisWorkbook

    ' Sheets to clear
    Dim sheetNames(0 To 4) As String
    sheetNames(0) = SHEET_ENERGY
    sheetNames(1) = SHEET_MOMENTUM
    sheetNames(2) = SHEET_YARNELL
    sheetNames(3) = SHEET_WSPRO
    sheetNames(4) = SHEET_SUMMARY

    Dim i As Long
    For i = 0 To 4
        Dim ws As Object
        On Error Resume Next
        Set ws = wb.Sheets(sheetNames(i))
        On Error GoTo 0

        If Not ws Is Nothing Then
            ws.Range("A22:Z200").ClearContents
            ws.Range("A77:Z90").ClearContents
        End If
        Set ws = Nothing
    Next i

    ' Delete chart objects on Summary sheet
    Dim wsSummary As Object
    On Error Resume Next
    Set wsSummary = wb.Sheets(SHEET_SUMMARY)
    On Error GoTo 0

    If Not wsSummary Is Nothing Then
        Dim co As Object
        For Each co In wsSummary.ChartObjects
            co.Delete
        Next co
    End If

    MsgBox "Results cleared.", vbInformation, "Bridge Loss Calculator"

End Sub

' =============================================================================
' PlotCrossSection
'
' Reads cross-section geometry via ReadCrossSection and delegates chart
' creation to GenerateCrossSectionChart (mod_Charts).
' =============================================================================
Public Sub PlotCrossSection()

    Dim wb As Object
    Set wb = ThisWorkbook

    Dim wsInput As Object
    Set wsInput = wb.Sheets(SHEET_INPUT)

    Dim stations()   As Double
    Dim elevations() As Double
    Dim manningsN()  As Double
    Dim nPts         As Long

    Call ReadCrossSection(wsInput, stations, elevations, manningsN, nPts)
    Call GenerateCrossSectionChart(wb, stations, elevations, nPts)

End Sub

' =============================================================================
' GenerateChartsBtn
'
' Button handler that delegates to GenerateAllCharts (mod_Charts).
' =============================================================================
Public Sub GenerateChartsBtn()
    Call GenerateAllCharts(ThisWorkbook)
End Sub

' =============================================================================
' PopulateSummary
'
' Reads results from each method sheet and builds a consolidated Summary table.
'
' Summary layout
' --------------
' Row  1  : Title
' Row  3+ : US WSEL table
'             Header row (col labels: method names)
'             One row per method reading row 79 of each method sheet
'             Gold HEC-RAS row (placeholder for reference values)
'             Abs diff row
'             % diff row
' (blank)
' Head Loss table — same structure, reading row 80
' (blank)
' TUFLOW FLC tables
'   Pier FLC table  — reading row 85
'   Super FLC table — reading row 86
' (blank)
' Flow Regime matrix — reading row 84
'
' Method columns are offset by the number of flow profiles discovered from the
' first available result sheet.  Profile names are read from row 78.
' Gold rows receive the COLOR_GOLD interior background.
'
' Parameters:
'   wb  — the workbook object (early or late bound)
' =============================================================================
Public Sub PopulateSummary(wb As Object)

    Dim wsSummary As Object
    On Error Resume Next
    Set wsSummary = wb.Sheets(SHEET_SUMMARY)
    On Error GoTo 0
    If wsSummary Is Nothing Then Exit Sub   ' Summary sheet must exist

    ' Clear previous summary output
    wsSummary.Range("A1:Z300").ClearContents
    wsSummary.Range("A1:Z300").Interior.ColorIndex = xlNone

    ' --- Method name array ---
    Dim methodNames(0 To 3) As String
    methodNames(0) = "Energy Method"
    methodNames(1) = "Momentum Method"
    methodNames(2) = "Yarnell"
    methodNames(3) = "WSPRO"

    Dim methodSheets(0 To 3) As String
    methodSheets(0) = SHEET_ENERGY
    methodSheets(1) = SHEET_MOMENTUM
    methodSheets(2) = SHEET_YARNELL
    methodSheets(3) = SHEET_WSPRO

    ' --- Discover number of profiles from the first method sheet that has data ---
    Dim nProfiles As Long
    nProfiles = 0
    Dim profileNames() As String

    Dim m As Long
    For m = 0 To 3
        Dim wsM As Object
        On Error Resume Next
        Set wsM = wb.Sheets(methodSheets(m))
        On Error GoTo 0
        If Not wsM Is Nothing Then
            ' Count non-empty cells in the profile name row (row 78, starting col 2)
            Dim c As Long
            c = 2
            Do While wsM.Cells(RES_ROW_PROFILE, c).Value <> ""
                c = c + 1
            Loop
            nProfiles = c - 2
            If nProfiles > 0 Then
                ReDim profileNames(0 To nProfiles - 1)
                Dim p As Long
                For p = 0 To nProfiles - 1
                    profileNames(p) = CStr(wsM.Cells(RES_ROW_PROFILE, 2 + p).Value)
                Next p
                Exit For
            End If
        End If
        Set wsM = Nothing
    Next m

    If nProfiles = 0 Then
        ' No results available yet — write a placeholder message
        wsSummary.Range("A1").Value = "Bridge Loss Calculator — Summary"
        wsSummary.Range("A1").Font.Bold = True
        wsSummary.Range("A3").Value = "(No calculation results found. Run calculations first.)"
        Exit Sub
    End If

    ' =========================================================================
    ' Title
    ' =========================================================================
    wsSummary.Range("A1").Value = "Bridge Loss Calculator — Summary"
    wsSummary.Range("A1").Font.Bold = True
    wsSummary.Range("A1").Font.Size = 14

    ' =========================================================================
    ' Helper: write a single results table block
    '   startRow  — first row of the block in Summary
    '   title     — section heading string
    '   sourceRow — row number on each method sheet to read values from
    '   withHecRas— True to include the gold HEC-RAS row + diff rows
    ' Returns the next available row after the block.
    ' =========================================================================

    ' We use an inline approach rather than a nested Sub, as VBA does not
    ' support local functions.  The logic is repeated for each block via a
    ' helper subroutine defined below (WriteResultsBlock).

    Dim nextRow As Long
    nextRow = 3

    ' --- US WSEL table ---
    nextRow = WriteResultsBlock(wsSummary, wb, methodNames, methodSheets, _
                                profileNames, nProfiles, nextRow, _
                                "US Water Surface Elevation (ft)", _
                                RES_ROW_WSEL, True)

    nextRow = nextRow + 1  ' blank separator row

    ' --- Head Loss table ---
    nextRow = WriteResultsBlock(wsSummary, wb, methodNames, methodSheets, _
                                profileNames, nProfiles, nextRow, _
                                "Head Loss (ft)", _
                                RES_ROW_LOSS, True)

    nextRow = nextRow + 1

    ' --- TUFLOW Pier FLC table ---
    nextRow = WriteResultsBlock(wsSummary, wb, methodNames, methodSheets, _
                                profileNames, nProfiles, nextRow, _
                                "TUFLOW Pier Form Loss Coefficient", _
                                RES_ROW_PIER_FLC, True)

    nextRow = nextRow + 1

    ' --- TUFLOW Super FLC table ---
    nextRow = WriteResultsBlock(wsSummary, wb, methodNames, methodSheets, _
                                profileNames, nProfiles, nextRow, _
                                "TUFLOW Superstructure Form Loss Coefficient", _
                                RES_ROW_SUPER_FLC, True)

    nextRow = nextRow + 1

    ' --- Flow Regime matrix ---
    nextRow = WriteResultsBlock(wsSummary, wb, methodNames, methodSheets, _
                                profileNames, nProfiles, nextRow, _
                                "Flow Regime", _
                                RES_ROW_REGIME, False)

End Sub

' =============================================================================
' WriteResultsBlock  (Private helper for PopulateSummary)
'
' Writes a single results comparison table onto wsSummary starting at
' startRow.  Returns the row index immediately after the last written row.
'
' Table structure:
'   Row startRow    : Section title (bold)
'   Row startRow+1  : Column headers (blank | profile names...)
'   Row startRow+2..
'     +n+1          : One row per method (method name | values per profile)
'   If withHecRas=True:
'     Next row      : HEC-RAS gold row (gold background, placeholder "—")
'     Next row      : Abs diff row
'     Next row      : % diff row
' =============================================================================
Private Function WriteResultsBlock( _
        wsSummary As Object, _
        wb        As Object, _
        methodNames()  As String, _
        methodSheets() As String, _
        profileNames() As String, _
        nProfiles As Long, _
        startRow  As Long, _
        title     As String, _
        sourceRow As Long, _
        withHecRas As Boolean) As Long

    Dim r As Long
    r = startRow

    ' --- Section title ---
    wsSummary.Cells(r, 1).Value = title
    wsSummary.Cells(r, 1).Font.Bold = True
    r = r + 1

    ' --- Column headers ---
    wsSummary.Cells(r, 1).Value = "Method"
    wsSummary.Cells(r, 1).Font.Bold = True
    Dim p As Long
    For p = 0 To nProfiles - 1
        wsSummary.Cells(r, 2 + p).Value = profileNames(p)
        wsSummary.Cells(r, 2 + p).Font.Bold = True
    Next p
    r = r + 1

    ' --- One data row per method ---
    Dim nMethods As Long
    nMethods = UBound(methodNames) - LBound(methodNames) + 1

    Dim m As Long
    For m = 0 To nMethods - 1
        wsSummary.Cells(r, 1).Value = methodNames(m)

        Dim wsM As Object
        On Error Resume Next
        Set wsM = wb.Sheets(methodSheets(m))
        On Error GoTo 0

        If Not wsM Is Nothing Then
            For p = 0 To nProfiles - 1
                Dim cellVal As Variant
                cellVal = wsM.Cells(sourceRow, 2 + p).Value
                wsSummary.Cells(r, 2 + p).Value = cellVal
            Next p
        Else
            ' Sheet missing — mark as not run
            wsSummary.Cells(r, 2).Value = "N/R"
        End If

        Set wsM = Nothing
        r = r + 1
    Next m

    ' --- HEC-RAS gold reference row + diff rows ---
    If withHecRas Then
        ' Gold HEC-RAS row
        wsSummary.Cells(r, 1).Value = "HEC-RAS (reference)"
        wsSummary.Cells(r, 1).Font.Bold = True
        For p = 0 To nProfiles - 1
            wsSummary.Cells(r, 2 + p).Value = "—"  ' placeholder for manual entry
        Next p
        ' Apply gold background across the label + data columns
        Dim goldRange As Object
        Set goldRange = wsSummary.Range( _
            wsSummary.Cells(r, 1), _
            wsSummary.Cells(r, 1 + nProfiles))
        goldRange.Interior.Color = COLOR_GOLD
        Dim hecRasRow As Long
        hecRasRow = r
        r = r + 1

        ' Abs diff row (blank — formulas can be added later, or left for manual use)
        wsSummary.Cells(r, 1).Value = "Abs. Diff (vs HEC-RAS)"
        wsSummary.Cells(r, 1).Font.Italic = True
        r = r + 1

        ' % diff row
        wsSummary.Cells(r, 1).Value = "% Diff (vs HEC-RAS)"
        wsSummary.Cells(r, 1).Font.Italic = True
        r = r + 1
    End If

    WriteResultsBlock = r

End Function

' =============================================================================
' GetCheckboxValue  (Private helper)
'
' Reads the cell at (row, col) on worksheet ws and interprets it as a Boolean.
'
' Truthy values  : True (Boolean), "TRUE", "YES", "1"  (case-insensitive)
' Falsy values   : False (Boolean), "FALSE", "NO",  "0"
' Empty cell     : defaults to True  (unset = run this method)
' Any other text : False
' =============================================================================
Private Function GetCheckboxValue(ws As Object, row As Long, col As Long) As Boolean

    Dim cellVal As Variant
    cellVal = ws.Cells(row, col).Value

    ' Empty defaults to True
    If IsEmpty(cellVal) Or cellVal = "" Then
        GetCheckboxValue = True
        Exit Function
    End If

    ' Boolean stored natively
    If VarType(cellVal) = vbBoolean Then
        GetCheckboxValue = CBool(cellVal)
        Exit Function
    End If

    ' Numeric: treat non-zero as True
    If IsNumeric(cellVal) Then
        GetCheckboxValue = (CDbl(cellVal) <> 0#)
        Exit Function
    End If

    ' String comparison (case-insensitive)
    Select Case UCase(Trim(CStr(cellVal)))
        Case "TRUE", "YES", "1"
            GetCheckboxValue = True
        Case Else
            GetCheckboxValue = False
    End Select

End Function
