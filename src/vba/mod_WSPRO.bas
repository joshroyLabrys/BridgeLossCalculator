Attribute VB_Name = "mod_WSPRO"
Option Explicit

' =============================================================================
' mod_WSPRO.bas
' FHWA WSPRO Bridge Waterways Analysis Method for Bridge Loss Calculator
'
' Reference: FHWA Report FHWA-IP-87-7, "Bridge Waterways Analysis Model"
'
' Governing equation:
'   dh = C * alpha1 * (V1^2 / 2g)
'   where C = Cb * Kf * Ke
'
'   Cb = base backwater coefficient (from bridge opening ratio M)
'   Kf = Froude number correction factor
'   Ke = eccentricity correction factor
'   M  = K_bridge / K_total  (conveyance-based opening ratio)
' =============================================================================

Private Const GRAVITY As Double = 32.2

' -----------------------------------------------------------------------------
' CalcOpeningRatio
'
' Computes the bridge opening ratio M = K_bridge / K_total.
'
' M represents the fraction of total channel conveyance that passes through
' the bridge opening. M approaching 1.0 means minimal constriction; M near
' 0.0 indicates heavy flow contraction.
'
' Returns 1.0 if Ktotal is zero or negative (zero-guard; no constriction).
' -----------------------------------------------------------------------------
Public Function CalcOpeningRatio(Kbridge As Double, Ktotal As Double) As Double
    If Ktotal <= 0# Then
        CalcOpeningRatio = 1#
    Else
        CalcOpeningRatio = Kbridge / Ktotal
    End If
End Function

' -----------------------------------------------------------------------------
' LookupBaseCb
'
' Returns the base backwater coefficient Cb by linear interpolation from the
' WSPRO table (FHWA-IP-87-7, Figure 7):
'
'   M:   0.1  0.2  0.3  0.4  0.5  0.6  0.7  0.8  0.9  1.0
'   Cb:  3.0  2.2  1.6  1.2  1.0  0.85 0.7  0.5  0.25 0.0
'
' Clamps: M <= 0.1 returns 3.0; M >= 1.0 returns 0.0.
' Linear interpolation between tabulated points.
' -----------------------------------------------------------------------------
Public Function LookupBaseCb(M As Double) As Double
    ' Tabulated M and Cb values (0-based, 10 entries)
    Dim mVals(0 To 9)  As Double
    Dim cbVals(0 To 9) As Double

    mVals(0) = 0.1 : cbVals(0) = 3#
    mVals(1) = 0.2 : cbVals(1) = 2.2
    mVals(2) = 0.3 : cbVals(2) = 1.6
    mVals(3) = 0.4 : cbVals(3) = 1.2
    mVals(4) = 0.5 : cbVals(4) = 1#
    mVals(5) = 0.6 : cbVals(5) = 0.85
    mVals(6) = 0.7 : cbVals(6) = 0.7
    mVals(7) = 0.8 : cbVals(7) = 0.5
    mVals(8) = 0.9 : cbVals(8) = 0.25
    mVals(9) = 1#  : cbVals(9) = 0#

    ' Clamp below lower bound
    If M <= 0.1 Then
        LookupBaseCb = 3#
        Exit Function
    End If

    ' Clamp above upper bound
    If M >= 1# Then
        LookupBaseCb = 0#
        Exit Function
    End If

    ' Linear interpolation between bracketing entries
    Dim i As Long
    For i = 0 To 8
        If M >= mVals(i) And M <= mVals(i + 1) Then
            Dim frac As Double
            frac = (M - mVals(i)) / (mVals(i + 1) - mVals(i))
            LookupBaseCb = cbVals(i) + frac * (cbVals(i + 1) - cbVals(i))
            Exit Function
        End If
    Next i

    ' Should not be reached given the clamps above, but be safe
    LookupBaseCb = 0#
End Function

' -----------------------------------------------------------------------------
' CalcFroudeCorrection
'
' Returns the Froude number correction factor Kf.
'
' Piecewise linear:
'   Fr <= 0.5  ->  Kf = 1.0
'   0.5 < Fr < 0.9  ->  Kf = 1.0 + (Fr - 0.5) / (0.9 - 0.5) * (1.2 - 1.0)
'                         linear from 1.0 at Fr=0.5 to 1.2 at Fr=0.9
'   Fr >= 0.9  ->  Kf = 1.2
' -----------------------------------------------------------------------------
Public Function CalcFroudeCorrection(froude As Double) As Double
    If froude <= 0.5 Then
        CalcFroudeCorrection = 1#
    ElseIf froude < 0.9 Then
        ' Linear interpolation: 1.0 at Fr=0.5 to 1.2 at Fr=0.9
        ' slope = (1.2 - 1.0) / (0.9 - 0.5) = 0.2 / 0.4 = 0.5
        CalcFroudeCorrection = 1# + (froude - 0.5#) * 0.5#
    Else
        CalcFroudeCorrection = 1.2
    End If
End Function

' -----------------------------------------------------------------------------
' CalcEccentricity
'
' Computes the flow eccentricity e from left and right overbank conveyances:
'   e = 1 - (K_shorter / K_longer)
'
' e = 0 when flow is perfectly symmetric; e -> 1 when one side carries no flow.
' Returns 0 if both Kleft and Kright are zero (no overbank flow present).
'
' Note: Ktotal parameter is accepted for signature consistency but is not used
' in the computation (eccentricity uses the left/right split directly).
' -----------------------------------------------------------------------------
Public Function CalcEccentricity(Kleft As Double, Kright As Double, _
                                  Ktotal As Double) As Double
    Dim shorter As Double
    Dim longer  As Double

    If Kleft <= Kright Then
        shorter = Kleft
        longer  = Kright
    Else
        shorter = Kright
        longer  = Kleft
    End If

    If longer > 0# Then
        CalcEccentricity = 1# - shorter / longer
    Else
        CalcEccentricity = 0#
    End If
End Function

' -----------------------------------------------------------------------------
' CalcEccentricityCorrection
'
' Returns the eccentricity correction factor Ke.
'
' Piecewise linear:
'   e <= 0   ->  Ke = 1.0
'   0 < e < 1  ->  Ke = 1.0 + e * 0.4  (linear from 1.0 at e=0 to 1.4 at e=1)
'   e >= 1   ->  Ke = 1.4
' -----------------------------------------------------------------------------
Public Function CalcEccentricityCorrection(eccentricity As Double) As Double
    If eccentricity <= 0# Then
        CalcEccentricityCorrection = 1#
    ElseIf eccentricity < 1# Then
        CalcEccentricityCorrection = 1# + eccentricity * 0.4#
    Else
        CalcEccentricityCorrection = 1.4
    End If
End Function

' -----------------------------------------------------------------------------
' CalcWSPROBackwater
'
' Computes the WSPRO backwater (head loss) at the bridge:
'   dh = C * alpha1 * (V1^2 / 2g)
'
' Parameters:
'   C       - combined coefficient = Cb * Kf * Ke
'   alpha1  - velocity distribution coefficient (1.0 for uniform flow)
'   velHead - downstream velocity head = alpha * V^2 / (2g)  (ft)
' -----------------------------------------------------------------------------
Public Function CalcWSPROBackwater(C As Double, alpha1 As Double, _
                                    velHead As Double) As Double
    CalcWSPROBackwater = C * alpha1 * velHead
End Function

' -----------------------------------------------------------------------------
' RunWSPRO
'
' Main entry point for the WSPRO method.
'
' Reads all inputs from the "Input" sheet, iterates over each flow profile,
' and writes 16 labeled calculation steps plus a results block to the "WSPRO"
' sheet.
'
' Results block layout (row 77 = header "RESULTS"):
'   Row 78  = Profile name
'   Row 79  = US WSEL (ft)
'   Row 80  = Head Loss (ft)
'   Row 81  = DS Velocity (ft/s)
'   Row 82  = DS Froude
'   Row 83  = Opening Ratio M
'   Row 84  = Flow Regime
'   Row 85  = TUFLOW Pier FLC
'   Row 86  = TUFLOW Super FLC
'
' The TUFLOW Super FLC is written as "N/A" for free-surface (F) flow regime.
' TUFLOW Pier FLC is estimated from pier blockage fraction of total head loss.
' -----------------------------------------------------------------------------
Public Sub RunWSPRO(wb As Object)
    Dim wsInput As Object
    Dim wsCalc  As Object
    Set wsInput = wb.Sheets("Input")
    Set wsCalc  = wb.Sheets("WSPRO")

    ' Clear previous calculation results (preserve header rows 1–21)
    wsCalc.Range("A22:Z90").ClearContents

    ' -------------------------------------------------------------------------
    ' Read inputs from the Input sheet
    ' -------------------------------------------------------------------------
    Dim stations()  As Double
    Dim elevations() As Double
    Dim manningsN() As Double
    Dim nPts As Long
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
    Dim nPiers As Long
    Call ReadPierData(wsInput, pierStations, pierWidths, pierShapes, nPiers)

    Dim profileNames()  As String
    Dim profileQ()      As Double
    Dim profileDSWSEL() As Double
    Dim nProfiles As Long
    Call ReadFlowProfiles(wsInput, profileNames, profileQ, profileDSWSEL, nProfiles)

    Dim maxIter         As Long
    Dim tolerance       As Double
    Dim initGuessOffset As Double
    Call ReadIterationSettings(wsInput, maxIter, tolerance, initGuessOffset)

    Dim leftBank  As Long
    Dim rightBank As Long
    Call FindBankStations(wsInput, leftBank, rightBank)

    ' -------------------------------------------------------------------------
    ' Write sheet header (rows 1–5)
    ' -------------------------------------------------------------------------
    wsCalc.Range("A1").Value     = "WSPRO METHOD"
    wsCalc.Range("A1").Font.Bold = True
    wsCalc.Range("A1").Font.Size = 14
    wsCalc.Range("A2").Value     = "Reference: FHWA Report FHWA-IP-87-7"
    wsCalc.Range("A3").Value     = "dh = C * alpha1 * (V1^2 / 2g),  where C = Cb * Kf * Ke"

    ' -------------------------------------------------------------------------
    ' Input echo block (rows 7–20)
    ' -------------------------------------------------------------------------
    Dim echoRow As Long
    echoRow = 7
    wsCalc.Cells(echoRow, 1).Value     = "INPUT ECHO"
    wsCalc.Cells(echoRow, 1).Font.Bold = True

    ' -------------------------------------------------------------------------
    ' Calculation step header (row 22)
    ' -------------------------------------------------------------------------
    Dim calcStartRow As Long
    calcStartRow = 22
    wsCalc.Cells(calcStartRow, 1).Value     = "Step"
    wsCalc.Cells(calcStartRow, 1).Font.Bold = True

    ' -------------------------------------------------------------------------
    ' Per-profile calculation loop
    ' -------------------------------------------------------------------------
    Dim p As Long
    For p = 0 To nProfiles - 1

        ' Column for this profile's values (label in col A, data starting col B)
        Dim col As Long
        col = 2 + p * 2

        ' Write profile name header
        wsCalc.Cells(calcStartRow, col).Value     = profileNames(p)
        wsCalc.Cells(calcStartRow, col).Font.Bold = True

        Dim Q       As Double
        Dim dsWSEL  As Double
        Q      = profileQ(p)
        dsWSEL = profileDSWSEL(p)

        Dim avgLowChord As Double
        avgLowChord = (lowChordLeft + lowChordRight) / 2#

        ' ----- Step 1: Total section conveyance (full cross-section) ----------
        Dim Ktotal As Double
        Ktotal = CalcConveyance(stations, elevations, manningsN, nPts, _
                                dsWSEL, leftBank, rightBank)

        ' ----- Step 2: Bridge opening conveyance (clipped to bridge span) -----
        Dim clipSta()  As Double
        Dim clipElev() As Double
        Dim clipN      As Long
        Call ClipCrossSectionToRange(stations, elevations, nPts, _
                                     bridgeLeftSta, bridgeRightSta, _
                                     clipSta, clipElev, clipN)

        ' Assign channel Manning's n uniformly across the bridge section
        Dim clipManN() As Double
        ReDim clipManN(0 To clipN - 1)
        Dim j As Long
        For j = 0 To clipN - 1
            clipManN(j) = manningsN(leftBank)
        Next j

        Dim Kbridge As Double
        Kbridge = CalcConveyance(clipSta, clipElev, clipManN, clipN, _
                                 dsWSEL, 0, clipN - 1)

        ' ----- Step 3: Opening ratio M ----------------------------------------
        Dim M As Double
        M = CalcOpeningRatio(Kbridge, Ktotal)

        ' ----- Step 4: DS velocity and velocity head --------------------------
        Dim dsArea    As Double
        Dim dsVel     As Double
        Dim dsVelHead As Double
        dsArea    = CalcFlowArea(stations, elevations, nPts, dsWSEL)
        dsVel     = CalcVelocity(Q, dsArea)
        dsVelHead = CalcVelocityHead(dsVel, 1#)

        ' ----- Step 5: DS Froude number ---------------------------------------
        Dim dsTW  As Double
        Dim frDS  As Double
        dsTW = CalcTopWidth(stations, elevations, nPts, dsWSEL)
        frDS = CalcFroude(dsVel, dsArea, dsTW)

        ' ----- Step 6: Cb from M lookup ---------------------------------------
        Dim Cb As Double
        Cb = LookupBaseCb(M)

        ' ----- Step 7: Kf from Froude -----------------------------------------
        Dim Kf As Double
        Kf = CalcFroudeCorrection(frDS)

        ' ----- Step 8 & 9: Eccentricity — split at bridge centerline ----------
        Dim bridgeCenterSta As Double
        bridgeCenterSta = (bridgeLeftSta + bridgeRightSta) / 2#

        Dim clipLeftSta()  As Double
        Dim clipLeftElev() As Double
        Dim clipLeftN      As Long
        Dim clipRightSta()  As Double
        Dim clipRightElev() As Double
        Dim clipRightN      As Long

        Call ClipCrossSectionToRange(stations, elevations, nPts, _
                                     stations(0), bridgeCenterSta, _
                                     clipLeftSta, clipLeftElev, clipLeftN)
        Call ClipCrossSectionToRange(stations, elevations, nPts, _
                                     bridgeCenterSta, stations(nPts - 1), _
                                     clipRightSta, clipRightElev, clipRightN)

        Dim clipLeftManN()  As Double
        Dim clipRightManN() As Double
        ReDim clipLeftManN(0 To clipLeftN - 1)
        ReDim clipRightManN(0 To clipRightN - 1)
        For j = 0 To clipLeftN - 1
            clipLeftManN(j) = manningsN(leftBank)
        Next j
        For j = 0 To clipRightN - 1
            clipRightManN(j) = manningsN(leftBank)
        Next j

        Dim Kleft  As Double
        Dim Kright As Double
        Kleft  = CalcConveyance(clipLeftSta,  clipLeftElev,  clipLeftManN,  clipLeftN,  dsWSEL, 0, clipLeftN - 1)
        Kright = CalcConveyance(clipRightSta, clipRightElev, clipRightManN, clipRightN, dsWSEL, 0, clipRightN - 1)

        Dim ecc As Double
        ecc = CalcEccentricity(Kleft, Kright, Ktotal)

        ' ----- Step 9 (continued): Ke from eccentricity -----------------------
        Dim Ke As Double
        Ke = CalcEccentricityCorrection(ecc)

        ' ----- Step 10: Combined coefficient C = Cb * Kf * Ke ----------------
        Dim C As Double
        C = Cb * Kf * Ke

        ' ----- Step 11: Backwater dh = C * 1.0 * velHead ---------------------
        Dim deltaH As Double
        deltaH = CalcWSPROBackwater(C, 1#, dsVelHead)

        ' ----- Step 12: US WSEL = DS WSEL + dh --------------------------------
        Dim usWSEL As Double
        usWSEL = dsWSEL + deltaH

        ' ----- Step 13: Flow regime -------------------------------------------
        Dim regime As String
        regime = DetectFlowRegime(usWSEL, avgLowChord, highChord)

        ' ----- Steps 14–16: TUFLOW FLCs (pier fraction from blockage ratio) ---
        Dim flcTotal As Double
        flcTotal = CalcTuflowFLC(deltaH, dsVel)

        ' Pier blockage area at DS WSEL
        Dim blockage  As Double
        Dim pierFrac  As Double
        If nPiers > 0 Then
            blockage = CalcPierBlockage(stations, elevations, nPts, _
                                        pierStations, pierWidths, nPiers, dsWSEL)
        Else
            blockage = 0#
        End If

        If dsArea > 0# Then
            pierFrac = blockage / dsArea
        Else
            pierFrac = 0#
        End If

        Dim flcPier  As Double
        Dim flcSuper As Double
        flcPier  = flcTotal * pierFrac
        flcSuper = flcTotal - flcPier

        ' =====================================================================
        ' Write 16 labeled calculation steps
        ' =====================================================================
        Dim r As Long
        r = calcStartRow + 1

        wsCalc.Cells(r, 1).Value   = "1. Total conveyance K (cfs):"
        wsCalc.Cells(r, col).Value = Round(Ktotal, 0)
        r = r + 1

        wsCalc.Cells(r, 1).Value   = "2. Bridge conveyance Kq (cfs):"
        wsCalc.Cells(r, col).Value = Round(Kbridge, 0)
        r = r + 1

        wsCalc.Cells(r, 1).Value   = "3. Opening ratio M:"
        wsCalc.Cells(r, col).Value = Round(M, 4)
        r = r + 1

        wsCalc.Cells(r, 1).Value   = "4. DS velocity (ft/s):"
        wsCalc.Cells(r, col).Value = Round(dsVel, 4)
        r = r + 1

        wsCalc.Cells(r, 1).Value   = "5. DS velocity head (ft):"
        wsCalc.Cells(r, col).Value = Round(dsVelHead, 4)
        r = r + 1

        wsCalc.Cells(r, 1).Value   = "6. DS Froude:"
        wsCalc.Cells(r, col).Value = Round(frDS, 4)
        r = r + 1

        wsCalc.Cells(r, 1).Value   = "7. Base coeff Cb:"
        wsCalc.Cells(r, col).Value = Round(Cb, 4)
        r = r + 1

        wsCalc.Cells(r, 1).Value   = "8. Froude correction Kf:"
        wsCalc.Cells(r, col).Value = Round(Kf, 4)
        r = r + 1

        wsCalc.Cells(r, 1).Value   = "9. Eccentricity e:"
        wsCalc.Cells(r, col).Value = Round(ecc, 4)
        r = r + 1

        wsCalc.Cells(r, 1).Value   = "10. Eccentricity correction Ke:"
        wsCalc.Cells(r, col).Value = Round(Ke, 4)
        r = r + 1

        wsCalc.Cells(r, 1).Value   = "11. Combined coeff C:"
        wsCalc.Cells(r, col).Value = Round(C, 4)
        r = r + 1

        wsCalc.Cells(r, 1).Value   = "12. Backwater dh (ft):"
        wsCalc.Cells(r, col).Value = Round(deltaH, 4)
        r = r + 1

        wsCalc.Cells(r, 1).Value                    = "13. US WSEL (ft):"
        wsCalc.Cells(r, col).Value                  = Round(usWSEL, 3)
        wsCalc.Cells(r, col).Font.Bold              = True
        r = r + 1

        wsCalc.Cells(r, 1).Value   = "14. Flow regime:"
        wsCalc.Cells(r, col).Value = regime
        r = r + 1

        wsCalc.Cells(r, 1).Value   = "15. TUFLOW Pier FLC:"
        wsCalc.Cells(r, col).Value = Round(flcPier, 4)
        r = r + 1

        wsCalc.Cells(r, 1).Value = "16. TUFLOW Super FLC:"
        If regime = "F" Then
            wsCalc.Cells(r, col).Value = "N/A"
        Else
            wsCalc.Cells(r, col).Value = Round(flcSuper, 4)
        End If
        r = r + 1

        ' =====================================================================
        ' Results block (rows 77–86)
        ' Row 77 = "RESULTS" header label
        ' Row 78 = Profile
        ' Row 79 = US WSEL
        ' Row 80 = Head Loss
        ' Row 81 = DS Velocity
        ' Row 82 = DS Froude
        ' Row 83 = Opening Ratio M
        ' Row 84 = Flow Regime
        ' Row 85 = TUFLOW Pier FLC
        ' Row 86 = TUFLOW Super FLC
        ' =====================================================================
        Dim resRow As Long
        resRow = 77

        ' Write row labels only once (first profile pass)
        If p = 0 Then
            wsCalc.Cells(resRow,     1).Value     = "RESULTS"
            wsCalc.Cells(resRow,     1).Font.Bold = True
            wsCalc.Cells(resRow + 1, 1).Value = "Profile"
            wsCalc.Cells(resRow + 2, 1).Value = "US WSEL (ft)"
            wsCalc.Cells(resRow + 3, 1).Value = "Head Loss (ft)"
            wsCalc.Cells(resRow + 4, 1).Value = "DS Velocity (ft/s)"
            wsCalc.Cells(resRow + 5, 1).Value = "DS Froude"
            wsCalc.Cells(resRow + 6, 1).Value = "Opening Ratio M"
            wsCalc.Cells(resRow + 7, 1).Value = "Flow Regime"
            wsCalc.Cells(resRow + 8, 1).Value = "TUFLOW Pier FLC"
            wsCalc.Cells(resRow + 9, 1).Value = "TUFLOW Super FLC"
        End If

        ' Write profile results (each profile in its own column, starting col B)
        Dim resCol As Long
        resCol = 2 + p

        wsCalc.Cells(resRow + 1, resCol).Value = profileNames(p)
        wsCalc.Cells(resRow + 2, resCol).Value = Round(usWSEL, 3)
        wsCalc.Cells(resRow + 3, resCol).Value = Round(deltaH, 3)
        wsCalc.Cells(resRow + 4, resCol).Value = Round(dsVel, 3)
        wsCalc.Cells(resRow + 5, resCol).Value = Round(frDS, 4)
        wsCalc.Cells(resRow + 6, resCol).Value = Round(M, 4)
        wsCalc.Cells(resRow + 7, resCol).Value = regime
        wsCalc.Cells(resRow + 8, resCol).Value = Round(flcPier, 4)
        If regime = "F" Then
            wsCalc.Cells(resRow + 9, resCol).Value = "N/A"
        Else
            wsCalc.Cells(resRow + 9, resCol).Value = Round(flcSuper, 4)
        End If

    Next p
End Sub
