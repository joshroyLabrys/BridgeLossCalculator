Attribute VB_Name = "mod_Utilities"
Option Explicit

' =============================================================================
' mod_Utilities.bas
' Input Reader Utilities for Bridge Loss Calculator
'
' All functions in this module read raw data from the "Input" worksheet and
' return it to the calling method modules (mod_Energy, mod_Yarnell, etc.).
'
' Row / column layout mirrors the fixed Input sheet template.
' =============================================================================

' -----------------------------------------------------------------------------
' Row layout constants
' (mirrors build.py dashboard layout — col A is visual spacer, data in B+)
'
' Row  1 : Title bar
' Row  2 : Subtitle
' Row  3 : Buttons
' Row  4 : Spacer
' Row  5 : Zone 1 banner (RIVER CROSS-SECTION)
' Row  6 : XS column headers          XS_HEADER_ROW
' Rows 7-56 : XS data (50 rows)       XS_FIRST_DATA
' Row 57 : Spacer
' Row 58 : Zone 2 banner (BRIDGE GEOMETRY)
' Row 59 : Sub-header "Opening Dimensions"
' Rows 60-67 : Bridge geometry        BRIDGE_START_ROW
'   60 = low chord left   (col C = 3)
'   61 = low chord right  (col C = 3)
'   62 = high chord       (col C = 3)
'   63 = (spacer row)
'   64 = bridge left sta  (col C = 3)
'   65 = bridge right sta (col C = 3)
'   66 = abutment slope   (col C = 3)
'   67 = skew angle       (col C = 3)
' Row 68 : Spacer
' Row 69 : Sub-header "Pier Data"
' Row 70 : Pier column headers        PIER_HEADER_ROW
' Rows 71-80 : Pier data (10 rows)    PIER_FIRST_DATA
' Row 81 : Spacer
' Row 82 : Zone 3 banner (FLOW PROFILES)
' Row 83 : Flow column headers        FLOW_HEADER_ROW
' Rows 84-93 : Flow data (10 rows)    FLOW_FIRST_DATA
' Row 94 : Spacer
' Row 95 : Zone 4 banner (COEFFICIENTS & SETTINGS)
' Row 96 : Sub-header "Energy Method" COEFF_START_ROW
' Row 97 : Cc                         COEFF_START_ROW + 1
' Row 98 : Ce                         COEFF_START_ROW + 2
' Row 99 : Spacer                     COEFF_START_ROW + 3
' Row 100: Sub-header "Yarnell"       COEFF_START_ROW + 4
' Row 101: K override                 COEFF_START_ROW + 5
' Row 102: Spacer                     COEFF_START_ROW + 6
' Row 103: Sub-header "Iteration"     COEFF_START_ROW + 7
' Row 104: Max iterations             COEFF_START_ROW + 8
' Row 105: Tolerance                  COEFF_START_ROW + 9
' Row 106: Initial guess offset       COEFF_START_ROW + 10
' Row 107: Spacer                     COEFF_START_ROW + 11
' Row 108: Methods to Run labels      COEFF_START_ROW + 12
' Row 109: Methods to Run toggles     COEFF_START_ROW + 13
' -----------------------------------------------------------------------------
Private Const XS_HEADER_ROW     As Long = 6
Private Const XS_FIRST_DATA     As Long = 7
Private Const XS_MAX_ROWS       As Long = 50

Private Const BRIDGE_START_ROW  As Long = 60

Private Const PIER_HEADER_ROW   As Long = 70
Private Const PIER_FIRST_DATA   As Long = 71
Private Const PIER_MAX_ROWS     As Long = 10

Private Const FLOW_HEADER_ROW   As Long = 83
Private Const FLOW_FIRST_DATA   As Long = 84
Private Const FLOW_MAX_ROWS     As Long = 10

Private Const COEFF_START_ROW   As Long = 96

' -----------------------------------------------------------------------------
' Column constants
' Col A (1) = visual spacer strip — never contains data
' Col B (2) = Point # / Pier # / Profile Name / Labels
' Col C (3) = Station / Value (for label-value pairs)
' Col D (4) = Elevation / Pier Width / DS WSEL
' Col E (5) = Manning's n / Pier Shape / Energy Slope
' Col F (6) = Bank Station label / Contraction reach
' Col G (7) = Expansion reach
' -----------------------------------------------------------------------------
Private Const COL_XS_POINT      As Long = 2   ' B — Point #
Private Const COL_XS_STATION    As Long = 3   ' C — Station (ft)
Private Const COL_XS_ELEV       As Long = 4   ' D — Elevation (ft)
Private Const COL_XS_MANN       As Long = 5   ' E — Manning's n
Private Const COL_XS_BANK       As Long = 6   ' F — Bank Station label

' =============================================================================
' ReadCrossSection
'
' Reads the cross-section point table from the Input sheet.
' Scanning begins at XS_FIRST_DATA and stops at the first row whose Station
' cell is empty, or after XS_MAX_ROWS rows, whichever comes first.
'
' Parameters:
'   ws           — Input worksheet object
'   stations()   — output: 1-based array of station values (ft)
'   elevations() — output: 1-based array of elevation values (ft)
'   manningsN()  — output: 1-based array of Manning's n values
'                  (blank cell defaults to 0.035)
'   nPts         — output: number of points actually read
' =============================================================================
Public Sub ReadCrossSection(ws As Object, _
                            ByRef stations()  As Double, _
                            ByRef elevations() As Double, _
                            ByRef manningsN()  As Double, _
                            ByRef nPts         As Long)

    ReDim stations(1 To XS_MAX_ROWS)
    ReDim elevations(1 To XS_MAX_ROWS)
    ReDim manningsN(1 To XS_MAX_ROWS)

    nPts = 0

    Dim r As Long
    For r = XS_FIRST_DATA To XS_FIRST_DATA + XS_MAX_ROWS - 1
        Dim cellSta As Object
        Set cellSta = ws.Cells(r, COL_XS_STATION)
        If IsEmpty(cellSta.Value) Or cellSta.Value = "" Then Exit For

        nPts = nPts + 1
        stations(nPts)  = CDbl(cellSta.Value)
        elevations(nPts) = CDbl(ws.Cells(r, COL_XS_ELEV).Value)

        Dim cellN As Object
        Set cellN = ws.Cells(r, COL_XS_MANN)
        If IsEmpty(cellN.Value) Or cellN.Value = "" Then
            manningsN(nPts) = 0.035
        Else
            manningsN(nPts) = CDbl(cellN.Value)
        End If
    Next r

    ' Trim arrays to actual count
    If nPts > 0 Then
        ReDim Preserve stations(1 To nPts)
        ReDim Preserve elevations(1 To nPts)
        ReDim Preserve manningsN(1 To nPts)
    End If
End Sub

' =============================================================================
' FindBankStations
'
' Scans the Bank Station? column (COL_XS_BANK) in the cross-section table for
' the text "Left Bank" and "Right Bank" (case-insensitive).
'
' Parameters:
'   ws            — Input worksheet object
'   leftBankIdx   — output: 1-based index of the Left Bank point
'                   (defaults to 0 if not found — callers treat 0 as the
'                    first point)
'   rightBankIdx  — output: 1-based index of the Right Bank point
'                   (defaults to the last point read by ReadCrossSection)
' =============================================================================
Public Sub FindBankStations(ws As Object, _
                            ByRef leftBankIdx  As Long, _
                            ByRef rightBankIdx As Long)

    ' Determine how many XS points exist so we can set the default right bank
    Dim lastPt As Long
    lastPt = 0

    Dim r As Long
    For r = XS_FIRST_DATA To XS_FIRST_DATA + XS_MAX_ROWS - 1
        If IsEmpty(ws.Cells(r, COL_XS_STATION).Value) Or _
           ws.Cells(r, COL_XS_STATION).Value = "" Then Exit For
        lastPt = lastPt + 1
    Next r

    ' Defaults
    leftBankIdx  = 0
    rightBankIdx = lastPt

    Dim idx As Long
    idx = 0
    For r = XS_FIRST_DATA To XS_FIRST_DATA + XS_MAX_ROWS - 1
        If IsEmpty(ws.Cells(r, COL_XS_STATION).Value) Or _
           ws.Cells(r, COL_XS_STATION).Value = "" Then Exit For
        idx = idx + 1
        Dim bankLabel As String
        bankLabel = LCase(Trim(CStr(ws.Cells(r, COL_XS_BANK).Value)))
        If bankLabel = "left bank"  Then leftBankIdx  = idx
        If bankLabel = "right bank" Then rightBankIdx = idx
    Next r
End Sub

' =============================================================================
' ReadBridgeGeometry
'
' Reads the bridge deck and geometry parameters from the fixed rows in the
' BRIDGE_START_ROW block (column 2 throughout).
'
' Cell mapping (BRIDGE_START_ROW = 60, values in col C = 3):
'   Row 60, col 3 -> lowChordLeft   (ft)
'   Row 61, col 3 -> lowChordRight  (ft)
'   Row 62, col 3 -> highChord      (ft)
'   Row 63 is a spacer — skipped
'   Row 64, col 3 -> bridgeLeftSta  (ft)
'   Row 65, col 3 -> bridgeRightSta (ft)
'   Row 66, col 3 -> abutment slope (not read here)
'   Row 67, col 3 -> skewAngle      (degrees; default 0)
'
' Parameters: all ByRef output Doubles
' =============================================================================
Public Sub ReadBridgeGeometry(ws As Object, _
                              ByRef bridgeLeftSta  As Double, _
                              ByRef bridgeRightSta As Double, _
                              ByRef lowChordLeft   As Double, _
                              ByRef lowChordRight  As Double, _
                              ByRef highChord      As Double, _
                              ByRef skewAngle      As Double)

    Const COL_VAL As Long = 3   ' col C — value column for label-value pairs

    lowChordLeft   = CDbl(ws.Cells(BRIDGE_START_ROW,     COL_VAL).Value)
    lowChordRight  = CDbl(ws.Cells(BRIDGE_START_ROW + 1, COL_VAL).Value)
    highChord      = CDbl(ws.Cells(BRIDGE_START_ROW + 2, COL_VAL).Value)
    ' Row BRIDGE_START_ROW + 3 is a spacer — skip
    bridgeLeftSta  = CDbl(ws.Cells(BRIDGE_START_ROW + 4, COL_VAL).Value)
    bridgeRightSta = CDbl(ws.Cells(BRIDGE_START_ROW + 5, COL_VAL).Value)

    Dim cellSkew As Object
    Set cellSkew = ws.Cells(BRIDGE_START_ROW + 7, COL_VAL)
    If IsEmpty(cellSkew.Value) Or cellSkew.Value = "" Then
        skewAngle = 0#
    Else
        skewAngle = CDbl(cellSkew.Value)
    End If
End Sub

' =============================================================================
' ReadPierData
'
' Reads the pier table beginning at PIER_FIRST_DATA.
'   Col B (2) = Pier # (display only — not read)
'   Col C (3) = pier station (ft)
'   Col D (4) = pier width   (ft)
'   Col E (5) = pier shape   (text; default "Round-nose")
'
' Scanning stops at first empty Station cell or after PIER_MAX_ROWS rows.
'
' Parameters:
'   ws            — Input worksheet object
'   pierStations() — output: 1-based array of pier station values
'   pierWidths()   — output: 1-based array of pier width values
'   pierShapes()   — output: 1-based array of pier shape strings
'   nPiers         — output: number of piers read
' =============================================================================
Public Sub ReadPierData(ws As Object, _
                        ByRef pierStations() As Double, _
                        ByRef pierWidths()   As Double, _
                        ByRef pierShapes()   As String, _
                        ByRef nPiers         As Long)

    ReDim pierStations(1 To PIER_MAX_ROWS)
    ReDim pierWidths(1 To PIER_MAX_ROWS)
    ReDim pierShapes(1 To PIER_MAX_ROWS)

    nPiers = 0

    Const COL_PIER_STA   As Long = 3   ' C
    Const COL_PIER_WIDTH As Long = 4   ' D
    Const COL_PIER_SHAPE As Long = 5   ' E

    Dim r As Long
    For r = PIER_FIRST_DATA To PIER_FIRST_DATA + PIER_MAX_ROWS - 1
        Dim cellSta As Object
        Set cellSta = ws.Cells(r, COL_PIER_STA)
        If IsEmpty(cellSta.Value) Or cellSta.Value = "" Then Exit For

        nPiers = nPiers + 1
        pierStations(nPiers) = CDbl(cellSta.Value)
        pierWidths(nPiers)   = CDbl(ws.Cells(r, COL_PIER_WIDTH).Value)

        Dim cellShape As Object
        Set cellShape = ws.Cells(r, COL_PIER_SHAPE)
        If IsEmpty(cellShape.Value) Or cellShape.Value = "" Then
            pierShapes(nPiers) = "Round-nose"
        Else
            pierShapes(nPiers) = CStr(cellShape.Value)
        End If
    Next r

    If nPiers > 0 Then
        ReDim Preserve pierStations(1 To nPiers)
        ReDim Preserve pierWidths(1 To nPiers)
        ReDim Preserve pierShapes(1 To nPiers)
    End If
End Sub

' =============================================================================
' ReadFlowProfiles
'
' Reads the flow profile table beginning at FLOW_FIRST_DATA.
'   Col B (2) = profile name  (text)
'   Col C (3) = discharge Q   (cfs)
'   Col D (4) = DS WSEL       (ft)
'
' Scanning stops at first empty Name cell or after FLOW_MAX_ROWS rows.
'
' Parameters:
'   ws               — Input worksheet object
'   profileNames()   — output: 1-based array of profile name strings
'   profileQ()       — output: 1-based array of discharge values (cfs)
'   profileDSWSEL()  — output: 1-based array of downstream WSEL values (ft)
'   nProfiles        — output: number of profiles read
' =============================================================================
Public Sub ReadFlowProfiles(ws As Object, _
                            ByRef profileNames()  As String, _
                            ByRef profileQ()      As Double, _
                            ByRef profileDSWSEL() As Double, _
                            ByRef nProfiles       As Long)

    ReDim profileNames(1 To FLOW_MAX_ROWS)
    ReDim profileQ(1 To FLOW_MAX_ROWS)
    ReDim profileDSWSEL(1 To FLOW_MAX_ROWS)

    nProfiles = 0

    Const COL_FLOW_NAME  As Long = 2   ' B
    Const COL_FLOW_Q     As Long = 3   ' C
    Const COL_FLOW_WSEL  As Long = 4   ' D

    Dim r As Long
    For r = FLOW_FIRST_DATA To FLOW_FIRST_DATA + FLOW_MAX_ROWS - 1
        Dim cellName As Object
        Set cellName = ws.Cells(r, COL_FLOW_NAME)
        If IsEmpty(cellName.Value) Or cellName.Value = "" Then Exit For

        nProfiles = nProfiles + 1
        profileNames(nProfiles)  = CStr(cellName.Value)
        profileQ(nProfiles)      = CDbl(ws.Cells(r, COL_FLOW_Q).Value)
        profileDSWSEL(nProfiles) = CDbl(ws.Cells(r, COL_FLOW_WSEL).Value)
    Next r

    If nProfiles > 0 Then
        ReDim Preserve profileNames(1 To nProfiles)
        ReDim Preserve profileQ(1 To nProfiles)
        ReDim Preserve profileDSWSEL(1 To nProfiles)
    End If
End Sub

' =============================================================================
' ReadReachLengths
'
' Reads reach-length and slope data from the flow profile table.
' Same row block as ReadFlowProfiles (FLOW_FIRST_DATA), additional columns:
'   Col E (5) = energy slope       (ft/ft; default 0.002)
'   Col F (6) = contraction length (ft;    default 80)
'   Col G (7) = expansion length   (ft;    default 80)
'
' Parameters:
'   ws             — Input worksheet object
'   contrLen()     — output: 1-based array of contraction reach lengths (ft)
'   expLen()       — output: 1-based array of expansion reach lengths (ft)
'   slope()        — output: 1-based array of energy slope values (ft/ft)
'   nProfiles      — number of profiles to read (caller already knows this
'                    from ReadFlowProfiles; passed ByVal)
' =============================================================================
Public Sub ReadReachLengths(ws As Object, _
                            ByRef contrLen()  As Double, _
                            ByRef expLen()    As Double, _
                            ByRef slope()     As Double, _
                            ByVal nProfiles   As Long)

    ReDim contrLen(1 To nProfiles)
    ReDim expLen(1 To nProfiles)
    ReDim slope(1 To nProfiles)

    Dim i As Long
    For i = 1 To nProfiles
        Dim r As Long
        r = FLOW_FIRST_DATA + i - 1

        ' Slope (col E = 5)
        Dim cellSlope As Object
        Set cellSlope = ws.Cells(r, 5)
        If IsEmpty(cellSlope.Value) Or cellSlope.Value = "" Then
            slope(i) = 0.002
        Else
            slope(i) = CDbl(cellSlope.Value)
        End If

        ' Contraction length (col F = 6)
        Dim cellContr As Object
        Set cellContr = ws.Cells(r, 6)
        If IsEmpty(cellContr.Value) Or cellContr.Value = "" Then
            contrLen(i) = 80#
        Else
            contrLen(i) = CDbl(cellContr.Value)
        End If

        ' Expansion length (col G = 7)
        Dim cellExp As Object
        Set cellExp = ws.Cells(r, 7)
        If IsEmpty(cellExp.Value) Or cellExp.Value = "" Then
            expLen(i) = 80#
        Else
            expLen(i) = CDbl(cellExp.Value)
        End If
    Next i
End Sub

' =============================================================================
' ReadEnergyCoeffs
'
' Reads the contraction (Cc) and expansion (Ce) loss coefficients.
'   COEFF_START_ROW + 1, col C (3) -> Cc  (default 0.3)
'   COEFF_START_ROW + 2, col C (3) -> Ce  (default 0.5)
'
' Parameters:
'   ws  — Input worksheet object
'   Cc  — output: contraction coefficient
'   Ce  — output: expansion coefficient
' =============================================================================
Public Sub ReadEnergyCoeffs(ws As Object, _
                            ByRef Cc As Double, _
                            ByRef Ce As Double)

    Const COL_VAL As Long = 3   ' col C — value column

    Dim cellCc As Object
    Set cellCc = ws.Cells(COEFF_START_ROW + 1, COL_VAL)
    If IsEmpty(cellCc.Value) Or cellCc.Value = "" Then
        Cc = 0.3
    Else
        Cc = CDbl(cellCc.Value)
    End If

    Dim cellCe As Object
    Set cellCe = ws.Cells(COEFF_START_ROW + 2, COL_VAL)
    If IsEmpty(cellCe.Value) Or cellCe.Value = "" Then
        Ce = 0.5
    Else
        Ce = CDbl(cellCe.Value)
    End If
End Sub

' =============================================================================
' ReadYarnellKOverride
'
' Reads an optional manual override for Yarnell's K pier shape coefficient.
'   COEFF_START_ROW + 5, col C (3)
'
' Returns 0 if the cell is blank, which callers interpret as "use automatic
' K lookup from pier shape string via GetYarnellK".
' =============================================================================
Public Function ReadYarnellKOverride(ws As Object) As Double
    Dim cellK As Object
    Set cellK = ws.Cells(COEFF_START_ROW + 5, 3)
    If IsEmpty(cellK.Value) Or cellK.Value = "" Then
        ReadYarnellKOverride = 0#
    Else
        ReadYarnellKOverride = CDbl(cellK.Value)
    End If
End Function

' =============================================================================
' ReadIterationSettings
'
' Reads the solver iteration control parameters.
'   COEFF_START_ROW + 8,  col C (3) -> maxIter         (default 100)
'   COEFF_START_ROW + 9,  col C (3) -> tolerance        (default 0.01)
'   COEFF_START_ROW + 10, col C (3) -> initGuessOffset  (default 0.5)
'
' Parameters:
'   ws               — Input worksheet object
'   maxIter          — output: maximum iteration count
'   tolerance        — output: convergence tolerance (ft)
'   initGuessOffset  — output: initial WSEL guess offset above DS WSEL (ft)
' =============================================================================
Public Sub ReadIterationSettings(ws As Object, _
                                 ByRef maxIter         As Long, _
                                 ByRef tolerance       As Double, _
                                 ByRef initGuessOffset As Double)

    Const COL_VAL As Long = 3   ' col C — value column

    Dim cellMax As Object
    Set cellMax = ws.Cells(COEFF_START_ROW + 8, COL_VAL)
    If IsEmpty(cellMax.Value) Or cellMax.Value = "" Then
        maxIter = 100
    Else
        maxIter = CLng(cellMax.Value)
    End If

    Dim cellTol As Object
    Set cellTol = ws.Cells(COEFF_START_ROW + 9, COL_VAL)
    If IsEmpty(cellTol.Value) Or cellTol.Value = "" Then
        tolerance = 0.01
    Else
        tolerance = CDbl(cellTol.Value)
    End If

    Dim cellOffset As Object
    Set cellOffset = ws.Cells(COEFF_START_ROW + 10, COL_VAL)
    If IsEmpty(cellOffset.Value) Or cellOffset.Value = "" Then
        initGuessOffset = 0.5
    Else
        initGuessOffset = CDbl(cellOffset.Value)
    End If
End Sub

' =============================================================================
' ValidateInputs
'
' Performs a lightweight sanity check on the Input sheet before any
' calculation module runs.
'
' Checks performed:
'   1. Cross-section has at least 3 points.
'   2. Low chord left elevation cell (BRIDGE_START_ROW, col C = 3) is not blank.
'   3. At least 1 flow profile is defined.
'
' Returns:
'   Empty string ("") if all checks pass.
'   A descriptive error message string if any check fails.
'   Multiple failures are concatenated with a newline separator.
' =============================================================================
Public Function ValidateInputs(ws As Object) As String
    Dim msgs As String
    msgs = ""

    ' ------------------------------------------------------------------
    ' Check 1: cross-section point count >= 3
    ' ------------------------------------------------------------------
    Dim nPts As Long
    nPts = 0
    Dim r As Long
    For r = XS_FIRST_DATA To XS_FIRST_DATA + XS_MAX_ROWS - 1
        If IsEmpty(ws.Cells(r, COL_XS_STATION).Value) Or _
           ws.Cells(r, COL_XS_STATION).Value = "" Then Exit For
        nPts = nPts + 1
    Next r

    If nPts < 3 Then
        msgs = msgs & "Cross-section must have at least 3 points (found " & nPts & ")." & vbLf
    End If

    ' ------------------------------------------------------------------
    ' Check 2: low chord left elevation is filled
    ' (BRIDGE_START_ROW = 60, value in col C = 3)
    ' ------------------------------------------------------------------
    Dim cellLC As Object
    Set cellLC = ws.Cells(BRIDGE_START_ROW, 3)
    If IsEmpty(cellLC.Value) Or cellLC.Value = "" Then
        msgs = msgs & "Low chord elevation (left) is required (row " & _
               BRIDGE_START_ROW & ", column C)." & vbLf
    End If

    ' ------------------------------------------------------------------
    ' Check 3: at least 1 flow profile
    ' (profile name in col B = 2)
    ' ------------------------------------------------------------------
    Dim nProfiles As Long
    nProfiles = 0
    For r = FLOW_FIRST_DATA To FLOW_FIRST_DATA + FLOW_MAX_ROWS - 1
        If IsEmpty(ws.Cells(r, 2).Value) Or ws.Cells(r, 2).Value = "" Then Exit For
        nProfiles = nProfiles + 1
    Next r

    If nProfiles < 1 Then
        msgs = msgs & "At least 1 flow profile must be defined." & vbLf
    End If

    ' Strip trailing newline, if any
    If Len(msgs) > 0 Then
        If Right(msgs, 1) = vbLf Then
            msgs = Left(msgs, Len(msgs) - 1)
        End If
    End If

    ValidateInputs = msgs
End Function
