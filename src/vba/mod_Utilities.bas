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
' -----------------------------------------------------------------------------
Private Const XS_HEADER_ROW     As Long = 4
Private Const XS_FIRST_DATA     As Long = 5
Private Const XS_MAX_ROWS       As Long = 50

Private Const BRIDGE_START_ROW  As Long = 29

Private Const PIER_HEADER_ROW   As Long = 40
Private Const PIER_FIRST_DATA   As Long = 41
Private Const PIER_MAX_ROWS     As Long = 10

Private Const LOW_CHORD_HEADER_ROW As Long = 52

Private Const FLOW_HEADER_ROW   As Long = 59
Private Const FLOW_FIRST_DATA   As Long = 60
Private Const FLOW_MAX_ROWS     As Long = 10

Private Const COEFF_START_ROW   As Long = 76

' -----------------------------------------------------------------------------
' Column constants (cross-section table)
' -----------------------------------------------------------------------------
Private Const COL_XS_POINT      As Long = 1   ' Point #
Private Const COL_XS_STATION    As Long = 2   ' Station (ft)
Private Const COL_XS_ELEV       As Long = 3   ' Elevation (ft)
Private Const COL_XS_MANN       As Long = 4   ' Manning's n
Private Const COL_XS_BANK       As Long = 5   ' Bank Station? label

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
' Cell mapping:
'   Row 29, col 2 -> lowChordLeft   (ft)
'   Row 30, col 2 -> lowChordRight  (ft)
'   Row 31, col 2 -> highChord      (ft)
'   Row 33, col 2 -> bridgeLeftSta  (ft)
'   Row 34, col 2 -> bridgeRightSta (ft)
'   Row 36, col 2 -> skewAngle      (degrees; default 0)
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

    lowChordLeft   = CDbl(ws.Cells(29, 2).Value)
    lowChordRight  = CDbl(ws.Cells(30, 2).Value)
    highChord      = CDbl(ws.Cells(31, 2).Value)
    bridgeLeftSta  = CDbl(ws.Cells(33, 2).Value)
    bridgeRightSta = CDbl(ws.Cells(34, 2).Value)

    Dim cellSkew As Object
    Set cellSkew = ws.Cells(36, 2)
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
'   Col 2 = pier station (ft)
'   Col 3 = pier width   (ft)
'   Col 4 = pier shape   (text; default "Round-nose")
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

    Dim r As Long
    For r = PIER_FIRST_DATA To PIER_FIRST_DATA + PIER_MAX_ROWS - 1
        Dim cellSta As Object
        Set cellSta = ws.Cells(r, 2)
        If IsEmpty(cellSta.Value) Or cellSta.Value = "" Then Exit For

        nPiers = nPiers + 1
        pierStations(nPiers) = CDbl(cellSta.Value)
        pierWidths(nPiers)   = CDbl(ws.Cells(r, 3).Value)

        Dim cellShape As Object
        Set cellShape = ws.Cells(r, 4)
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
'   Col 1 = profile name  (text)
'   Col 2 = discharge Q   (cfs)
'   Col 3 = DS WSEL       (ft)
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

    Dim r As Long
    For r = FLOW_FIRST_DATA To FLOW_FIRST_DATA + FLOW_MAX_ROWS - 1
        Dim cellName As Object
        Set cellName = ws.Cells(r, 1)
        If IsEmpty(cellName.Value) Or cellName.Value = "" Then Exit For

        nProfiles = nProfiles + 1
        profileNames(nProfiles)  = CStr(cellName.Value)
        profileQ(nProfiles)      = CDbl(ws.Cells(r, 2).Value)
        profileDSWSEL(nProfiles) = CDbl(ws.Cells(r, 3).Value)
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
'   Col 4 = energy slope   (ft/ft; default 0.002)
'   Col 5 = contraction length (ft; default 80)
'   Col 6 = expansion length   (ft; default 80)
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

        ' Slope (col 4)
        Dim cellSlope As Object
        Set cellSlope = ws.Cells(r, 4)
        If IsEmpty(cellSlope.Value) Or cellSlope.Value = "" Then
            slope(i) = 0.002
        Else
            slope(i) = CDbl(cellSlope.Value)
        End If

        ' Contraction length (col 5)
        Dim cellContr As Object
        Set cellContr = ws.Cells(r, 5)
        If IsEmpty(cellContr.Value) Or cellContr.Value = "" Then
            contrLen(i) = 80#
        Else
            contrLen(i) = CDbl(cellContr.Value)
        End If

        ' Expansion length (col 6)
        Dim cellExp As Object
        Set cellExp = ws.Cells(r, 6)
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
'   COEFF_START_ROW + 1, col 2 -> Cc  (default 0.3)
'   COEFF_START_ROW + 2, col 2 -> Ce  (default 0.5)
'
' Parameters:
'   ws  — Input worksheet object
'   Cc  — output: contraction coefficient
'   Ce  — output: expansion coefficient
' =============================================================================
Public Sub ReadEnergyCoeffs(ws As Object, _
                            ByRef Cc As Double, _
                            ByRef Ce As Double)

    Dim cellCc As Object
    Set cellCc = ws.Cells(COEFF_START_ROW + 1, 2)
    If IsEmpty(cellCc.Value) Or cellCc.Value = "" Then
        Cc = 0.3
    Else
        Cc = CDbl(cellCc.Value)
    End If

    Dim cellCe As Object
    Set cellCe = ws.Cells(COEFF_START_ROW + 2, 2)
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
'   COEFF_START_ROW + 5, col 2
'
' Returns 0 if the cell is blank, which callers interpret as "use automatic
' K lookup from pier shape string via GetYarnellK".
' =============================================================================
Public Function ReadYarnellKOverride(ws As Object) As Double
    Dim cellK As Object
    Set cellK = ws.Cells(COEFF_START_ROW + 5, 2)
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
'   COEFF_START_ROW + 8,  col 2 -> maxIter         (default 100)
'   COEFF_START_ROW + 9,  col 2 -> tolerance        (default 0.01)
'   COEFF_START_ROW + 10, col 2 -> initGuessOffset  (default 0.5)
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

    Dim cellMax As Object
    Set cellMax = ws.Cells(COEFF_START_ROW + 8, 2)
    If IsEmpty(cellMax.Value) Or cellMax.Value = "" Then
        maxIter = 100
    Else
        maxIter = CLng(cellMax.Value)
    End If

    Dim cellTol As Object
    Set cellTol = ws.Cells(COEFF_START_ROW + 9, 2)
    If IsEmpty(cellTol.Value) Or cellTol.Value = "" Then
        tolerance = 0.01
    Else
        tolerance = CDbl(cellTol.Value)
    End If

    Dim cellOffset As Object
    Set cellOffset = ws.Cells(COEFF_START_ROW + 10, 2)
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
'   2. Low chord left elevation cell (row 29, col 2) is not blank.
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
    ' ------------------------------------------------------------------
    Dim cellLC As Object
    Set cellLC = ws.Cells(29, 2)
    If IsEmpty(cellLC.Value) Or cellLC.Value = "" Then
        msgs = msgs & "Low chord elevation (left) is required (row 29, column B)." & vbLf
    End If

    ' ------------------------------------------------------------------
    ' Check 3: at least 1 flow profile
    ' ------------------------------------------------------------------
    Dim nProfiles As Long
    nProfiles = 0
    For r = FLOW_FIRST_DATA To FLOW_FIRST_DATA + FLOW_MAX_ROWS - 1
        If IsEmpty(ws.Cells(r, 1).Value) Or ws.Cells(r, 1).Value = "" Then Exit For
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
