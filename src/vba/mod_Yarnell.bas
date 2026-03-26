Attribute VB_Name = "mod_Yarnell"
Option Explicit

' =============================================================================
' mod_Yarnell.bas
' Yarnell empirical pier loss method for Bridge Loss Calculator
'
' Reference: Yarnell, D.L. (1934), "Bridge Piers as Channel Obstructions"
'            U.S. Dept. of Agriculture Technical Bulletin 442
'
' Governing equation:
'   Dy = K * (K + 5 - 0.6) * (alpha + 15*alpha^4) * (V^2/2g)
' Where:
'   K     = pier shape coefficient
'   alpha = ratio of pier obstruction area to total flow area
'   V     = downstream velocity (ft/s)
'   g     = 32.2 ft/s^2
'
' This method applies to free-surface (Type F) flow only.
' Pressure and overtopping regimes are flagged as N/A.
' =============================================================================

Private Const GRAVITY As Double = 32.2

' -----------------------------------------------------------------------------
' GetYarnellK
'
' Returns the Yarnell K pier shape coefficient for the given pier shape string.
'
' Recognised values (case-insensitive, leading/trailing spaces ignored):
'   "square"     -> 1.25
'   "round-nose" -> 0.9
'   "cylindrical"-> 1.0
'   "sharp"      -> 0.7
'
' Any unrecognised value returns 0.9 (round-nose default).
' -----------------------------------------------------------------------------
Public Function GetYarnellK(pierShape As String) As Double
    Select Case LCase(Trim(pierShape))
        Case "square":      GetYarnellK = 1.25
        Case "round-nose":  GetYarnellK = 0.9
        Case "cylindrical": GetYarnellK = 1#
        Case "sharp":       GetYarnellK = 0.7
        Case Else:          GetYarnellK = 0.9   ' Default to round-nose
    End Select
End Function

' -----------------------------------------------------------------------------
' CalcYarnellBackwater
'
' Computes the Yarnell backwater rise (Dy) in feet.
'
' Formula:
'   Dy = K * (K + 5 - 0.6) * (alpha + 15*alpha^4) * (V^2 / 2g)
'
' Parameters:
'   K        - pier shape coefficient (from GetYarnellK)
'   alpha    - obstruction ratio = pier blockage area / total DS flow area
'   velocity - downstream velocity (ft/s)
'
' Returns:
'   Backwater rise in feet.
' -----------------------------------------------------------------------------
Public Function CalcYarnellBackwater(K As Double, alpha As Double, _
                                     velocity As Double) As Double
    Dim velHead As Double
    velHead = (velocity ^ 2#) / (2# * GRAVITY)

    Dim alphaTerm As Double
    alphaTerm = alpha + 15# * (alpha ^ 4#)

    CalcYarnellBackwater = K * (K + 5# - 0.6) * alphaTerm * velHead
End Function

' -----------------------------------------------------------------------------
' RunYarnell
'
' Main entry point.  Reads inputs from the Input sheet, computes the Yarnell
' backwater for each flow profile, and writes step-by-step calculations plus
' a results summary block to the Yarnell worksheet.
'
' Parameters:
'   wb - the Excel Workbook object (late-bound As Object for portability)
'
' Sheet layout produced:
'   Rows  1- 5  Header (method name, reference, equation)
'   Rows  7-20  Input echo
'   Rows 22-75  Step-by-step calculations (one double-column per profile)
'   Row  77     "RESULTS" label
'   Row  78     Profile names
'   Row  79     US WSEL (ft)
'   Row  80     Head Loss / Dy (ft)
'   Row  81     DS Velocity (ft/s)
'   Row  82     DS Froude number
'   Row  83     Flow Regime
'   Row  84     Flow Regime (copy — consumed by Summary sheet)
'   Row  85     TUFLOW Pier FLC
'   Row  86     TUFLOW Super FLC ("N/A" for Yarnell — pier-only method)
' -----------------------------------------------------------------------------
Public Sub RunYarnell(wb As Object)

    Dim wsInput As Object
    Dim wsCalc  As Object
    Set wsInput = wb.Sheets("Input")
    Set wsCalc  = wb.Sheets("Yarnell")

    ' ------------------------------------------------------------------
    ' Clear previous results
    ' ------------------------------------------------------------------
    wsCalc.Range("A22:Z90").ClearContents

    ' ------------------------------------------------------------------
    ' Read inputs from Input sheet (mod_Utilities helpers)
    ' ------------------------------------------------------------------
    Dim stations()  As Double
    Dim elevations() As Double
    Dim manningsN() As Double
    Dim nPts        As Long
    Call ReadCrossSection(wsInput, stations, elevations, manningsN, nPts)

    Dim bridgeLeftSta  As Double
    Dim bridgeRightSta As Double
    Dim lowChordLeft   As Double
    Dim lowChordRight  As Double
    Dim highChord      As Double
    Dim skewAngle      As Double
    Call ReadBridgeGeometry(wsInput, bridgeLeftSta, bridgeRightSta, _
                            lowChordLeft, lowChordRight, highChord, skewAngle)

    Dim pierStations() As Double
    Dim pierWidths()   As Double
    Dim pierShapes()   As String
    Dim nPiers         As Long
    Call ReadPierData(wsInput, pierStations, pierWidths, pierShapes, nPiers)

    Dim profileNames()  As String
    Dim profileQ()      As Double
    Dim profileDSWSEL() As Double
    Dim nProfiles       As Long
    Call ReadFlowProfiles(wsInput, profileNames, profileQ, profileDSWSEL, nProfiles)

    Dim yarnellKOverride As Double
    yarnellKOverride = ReadYarnellKOverride(wsInput)

    Dim leftBank  As Long
    Dim rightBank As Long
    Call FindBankStations(wsInput, leftBank, rightBank)

    ' ------------------------------------------------------------------
    ' Write header (rows 1-3)
    ' ------------------------------------------------------------------
    wsCalc.Range("A1").Value     = "YARNELL METHOD"
    wsCalc.Range("A1").Font.Bold = True
    wsCalc.Range("A1").Font.Size = 14
    wsCalc.Range("A2").Value = "Reference: Yarnell, D.L. (1934), ""Bridge Piers as Channel Obstructions"""
    wsCalc.Range("A3").Value = "Equation: Dy = K(K+5-0.6)(a+15a^4)(V^2/2g)"

    ' ------------------------------------------------------------------
    ' Input echo (rows 7-20)
    ' ------------------------------------------------------------------
    Dim avgLowChordEcho As Double
    avgLowChordEcho = (lowChordLeft + lowChordRight) / 2#

    Dim echoRow As Long
    echoRow = 7
    wsCalc.Cells(echoRow, 1).Value     = "INPUT ECHO"
    wsCalc.Cells(echoRow, 1).Font.Bold = True

    wsCalc.Cells(echoRow + 1, 1).Value = "Number of cross-section points:"
    wsCalc.Cells(echoRow + 1, 2).Value = nPts
    wsCalc.Cells(echoRow + 2, 1).Value = "Number of piers:"
    wsCalc.Cells(echoRow + 2, 2).Value = nPiers
    wsCalc.Cells(echoRow + 3, 1).Value = "Bridge left station (ft):"
    wsCalc.Cells(echoRow + 3, 2).Value = bridgeLeftSta
    wsCalc.Cells(echoRow + 4, 1).Value = "Bridge right station (ft):"
    wsCalc.Cells(echoRow + 4, 2).Value = bridgeRightSta
    wsCalc.Cells(echoRow + 5, 1).Value = "Low chord elevation — left (ft):"
    wsCalc.Cells(echoRow + 5, 2).Value = lowChordLeft
    wsCalc.Cells(echoRow + 6, 1).Value = "Low chord elevation — right (ft):"
    wsCalc.Cells(echoRow + 6, 2).Value = lowChordRight
    wsCalc.Cells(echoRow + 7, 1).Value = "Average low chord (ft):"
    wsCalc.Cells(echoRow + 7, 2).Value = avgLowChordEcho
    wsCalc.Cells(echoRow + 8, 1).Value = "High chord elevation (ft):"
    wsCalc.Cells(echoRow + 8, 2).Value = highChord
    wsCalc.Cells(echoRow + 9, 1).Value = "Skew angle (deg):"
    wsCalc.Cells(echoRow + 9, 2).Value = skewAngle
    wsCalc.Cells(echoRow + 10, 1).Value = "Number of flow profiles:"
    wsCalc.Cells(echoRow + 10, 2).Value = nProfiles
    If yarnellKOverride > 0# Then
        wsCalc.Cells(echoRow + 11, 1).Value = "Yarnell K override:"
        wsCalc.Cells(echoRow + 11, 2).Value = yarnellKOverride
    End If

    ' ------------------------------------------------------------------
    ' Calculations per profile (rows 22+)
    ' ------------------------------------------------------------------
    Dim calcStartRow As Long
    calcStartRow = 22

    ' Column header row
    wsCalc.Cells(calcStartRow, 1).Value     = "Step"
    wsCalc.Cells(calcStartRow, 1).Font.Bold = True

    Dim p   As Long
    Dim col As Long

    For p = 0 To nProfiles - 1

        col = 2 + p * 2   ' Two columns per profile (label column + value column)

        wsCalc.Cells(calcStartRow, col).Value     = profileNames(p)
        wsCalc.Cells(calcStartRow, col).Font.Bold = True

        Dim Q       As Double
        Dim dsWSEL  As Double
        Q      = profileQ(p)
        dsWSEL = profileDSWSEL(p)

        Dim avgLowChord As Double
        avgLowChord = (lowChordLeft + lowChordRight) / 2#

        ' Detect flow regime at DS WSEL
        Dim regime As String
        regime = DetectFlowRegime(dsWSEL, avgLowChord, highChord)

        Dim r As Long
        r = calcStartRow + 1

        ' ------ Yarnell only valid for free-surface flow ------
        If regime <> "F" Then
            wsCalc.Cells(r, 1).Value          = "Flow regime:"
            wsCalc.Cells(r, col).Value        = regime & " — Yarnell N/A"
            wsCalc.Cells(r, col).Font.Color   = RGB(255, 0, 0)

            ' Write N/A placeholders to results block
            Dim naResRow As Long
            naResRow = 77
            If p = 0 Then
                wsCalc.Cells(naResRow, 1).Value     = "RESULTS"
                wsCalc.Cells(naResRow, 1).Font.Bold = True
                wsCalc.Cells(naResRow + 1, 1).Value  = "Profile"
                wsCalc.Cells(naResRow + 2, 1).Value  = "US WSEL (ft)"
                wsCalc.Cells(naResRow + 3, 1).Value  = "Head Loss (ft)"
                wsCalc.Cells(naResRow + 4, 1).Value  = "DS Velocity (ft/s)"
                wsCalc.Cells(naResRow + 5, 1).Value  = "DS Froude"
                wsCalc.Cells(naResRow + 6, 1).Value  = "Flow Regime"
                wsCalc.Cells(naResRow + 7, 1).Value  = "Flow Regime"
                wsCalc.Cells(naResRow + 8, 1).Value  = "TUFLOW Pier FLC"
                wsCalc.Cells(naResRow + 9, 1).Value  = "TUFLOW Super FLC"
            End If
            Dim naResCol As Long
            naResCol = 2 + p
            wsCalc.Cells(naResRow + 1, naResCol).Value = profileNames(p)
            wsCalc.Cells(naResRow + 2, naResCol).Value = "N/A"
            wsCalc.Cells(naResRow + 3, naResCol).Value = "N/A"
            wsCalc.Cells(naResRow + 4, naResCol).Value = "N/A"
            wsCalc.Cells(naResRow + 5, naResCol).Value = "N/A"
            wsCalc.Cells(naResRow + 6, naResCol).Value = regime
            wsCalc.Cells(naResRow + 7, naResCol).Value = regime
            wsCalc.Cells(naResRow + 8, naResCol).Value = "N/A"
            wsCalc.Cells(naResRow + 9, naResCol).Value = "N/A"

            GoTo NextProfile
        End If

        ' ------ Step 1: DS flow area ------
        Dim dsArea As Double
        dsArea = CalcFlowArea(stations, elevations, nPts, dsWSEL)

        wsCalc.Cells(r, 1).Value    = "1. DS flow area (sq ft):"
        wsCalc.Cells(r, col).Value  = Round(dsArea, 2)
        r = r + 1

        ' ------ Step 2: DS velocity ------
        Dim dsVelocity As Double
        dsVelocity = CalcVelocity(Q, dsArea)

        wsCalc.Cells(r, 1).Value    = "2. DS velocity V (ft/s):"
        wsCalc.Cells(r, col).Value  = Round(dsVelocity, 4)
        r = r + 1

        ' ------ Step 3: Velocity head ------
        Dim velHead As Double
        velHead = CalcVelocityHead(dsVelocity, 1#)

        wsCalc.Cells(r, 1).Value    = "3. Velocity head V^2/2g (ft):"
        wsCalc.Cells(r, col).Value  = Round(velHead, 4)
        r = r + 1

        ' ------ Step 4: Pier blockage area ------
        Dim pierBlockage As Double
        If nPiers > 0 Then
            pierBlockage = CalcPierBlockage(stations, elevations, nPts, _
                                            pierStations, pierWidths, nPiers, dsWSEL)
        Else
            pierBlockage = 0#
        End If

        wsCalc.Cells(r, 1).Value    = "4. Pier blockage area (sq ft):"
        wsCalc.Cells(r, col).Value  = Round(pierBlockage, 2)
        r = r + 1

        ' ------ Step 5: Obstruction ratio alpha ------
        Dim alpha As Double
        If dsArea > 0# Then
            alpha = pierBlockage / dsArea
        Else
            alpha = 0#
        End If

        wsCalc.Cells(r, 1).Value    = "5. Obstruction ratio alpha:"
        wsCalc.Cells(r, col).Value  = Round(alpha, 6)
        r = r + 1

        ' ------ Step 6: K coefficient ------
        Dim K As Double
        If yarnellKOverride > 0# Then
            K = yarnellKOverride
        ElseIf nPiers > 0 Then
            K = GetYarnellK(pierShapes(0))   ' Use first pier's shape
        Else
            K = 0.9   ' Default round-nose
        End If

        wsCalc.Cells(r, 1).Value    = "6. Pier shape coeff K:"
        wsCalc.Cells(r, col).Value  = Round(K, 4)
        r = r + 1

        ' ------ Step 7: Backwater rise Dy ------
        Dim deltaY As Double
        deltaY = CalcYarnellBackwater(K, alpha, dsVelocity)

        wsCalc.Cells(r, 1).Value    = "7. Backwater rise Dy (ft):"
        wsCalc.Cells(r, col).Value  = Round(deltaY, 4)
        r = r + 1

        ' ------ Step 8: Upstream WSEL ------
        Dim usWSEL As Double
        usWSEL = dsWSEL + deltaY

        wsCalc.Cells(r, 1).Value           = "8. US WSEL (ft):"
        wsCalc.Cells(r, col).Value         = Round(usWSEL, 4)
        wsCalc.Cells(r, col).Font.Bold     = True
        r = r + 1

        ' ------ Step 9: DS Froude number ------
        Dim dsTopWidth As Double
        dsTopWidth = CalcTopWidth(stations, elevations, nPts, dsWSEL)
        Dim frDS As Double
        frDS = CalcFroude(dsVelocity, dsArea, dsTopWidth)

        wsCalc.Cells(r, 1).Value    = "9. DS Froude number:"
        wsCalc.Cells(r, col).Value  = Round(frDS, 4)
        r = r + 1

        ' ------ Step 10: Flow regime ------
        wsCalc.Cells(r, 1).Value    = "10. Flow regime:"
        wsCalc.Cells(r, col).Value  = "F (Free Surface)"
        r = r + 1

        ' ------ Step 11: TUFLOW Pier FLC ------
        Dim flcPier As Double
        flcPier = CalcTuflowPierFLC(deltaY, dsVelocity)

        wsCalc.Cells(r, 1).Value    = "11. TUFLOW Pier FLC:"
        wsCalc.Cells(r, col).Value  = Round(flcPier, 4)
        r = r + 1

        ' ------ Step 12: TUFLOW Superstructure FLC (N/A for Yarnell) ------
        wsCalc.Cells(r, 1).Value    = "12. TUFLOW Super FLC:"
        wsCalc.Cells(r, col).Value  = "N/A"
        r = r + 1

        ' ------------------------------------------------------------------
        ' Results block (starting row 77)
        ' Row 77: "RESULTS" label
        ' Row 78: Profile name
        ' Row 79: US WSEL
        ' Row 80: Head Loss (Dy)
        ' Row 81: DS Velocity
        ' Row 82: DS Froude
        ' Row 83: Flow Regime
        ' Row 84: Flow Regime (copy for Summary sheet consumption)
        ' Row 85: TUFLOW Pier FLC
        ' Row 86: TUFLOW Super FLC
        ' ------------------------------------------------------------------
        Dim resRow As Long
        resRow = 77

        If p = 0 Then
            wsCalc.Cells(resRow, 1).Value     = "RESULTS"
            wsCalc.Cells(resRow, 1).Font.Bold = True
            wsCalc.Cells(resRow + 1, 1).Value = "Profile"
            wsCalc.Cells(resRow + 2, 1).Value = "US WSEL (ft)"
            wsCalc.Cells(resRow + 3, 1).Value = "Head Loss (ft)"
            wsCalc.Cells(resRow + 4, 1).Value = "DS Velocity (ft/s)"
            wsCalc.Cells(resRow + 5, 1).Value = "DS Froude"
            wsCalc.Cells(resRow + 6, 1).Value = "Flow Regime"
            wsCalc.Cells(resRow + 7, 1).Value = "Flow Regime"
            wsCalc.Cells(resRow + 8, 1).Value = "TUFLOW Pier FLC"
            wsCalc.Cells(resRow + 9, 1).Value = "TUFLOW Super FLC"
        End If

        Dim resCol As Long
        resCol = 2 + p
        wsCalc.Cells(resRow + 1, resCol).Value = profileNames(p)
        wsCalc.Cells(resRow + 2, resCol).Value = Round(usWSEL, 3)
        wsCalc.Cells(resRow + 3, resCol).Value = Round(deltaY, 3)
        wsCalc.Cells(resRow + 4, resCol).Value = Round(dsVelocity, 3)
        wsCalc.Cells(resRow + 5, resCol).Value = Round(frDS, 4)
        wsCalc.Cells(resRow + 6, resCol).Value = regime
        wsCalc.Cells(resRow + 7, resCol).Value = regime
        wsCalc.Cells(resRow + 8, resCol).Value = Round(flcPier, 4)
        wsCalc.Cells(resRow + 9, resCol).Value = "N/A"

NextProfile:
    Next p

End Sub
