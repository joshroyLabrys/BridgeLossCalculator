Attribute VB_Name = "mod_Energy"
Option Explicit

' =============================================================================
' mod_Energy.bas
' Standard Step Energy Method for Bridge Loss Calculator
'
' Reference: HEC-RAS Hydraulic Reference Manual, Chapter 5
' Solves energy balance between four cross-sections:
'   Section 1 (downstream) → BD (bridge downstream face) →
'   BU (bridge upstream face) → Section 3 (upstream/approach)
'
' Energy equation:
'   WS_us = WS_ds + h_f + Cc * |Δ(αV²/2g)| + Ce * |Δ(αV²/2g)|
' =============================================================================

Private Const GRAVITY As Double = 32.2

' -----------------------------------------------------------------------------
' RunEnergy
'
' Main entry point for the standard step energy method.
' Reads all inputs from the "Input" sheet, computes hydraulic properties at
' downstream, bridge, and upstream sections for each flow profile, iterates
' for upstream WSEL using bisection + secant, writes step-by-step calculations
' (16 labeled steps), iteration log, and results block to the "Energy Method"
' sheet.
'
' Parameters:
'   wb  — the workbook object (early or late bound)
' -----------------------------------------------------------------------------
Public Sub RunEnergy(wb As Object)
    Dim wsInput As Object, wsCalc As Object
    Set wsInput = wb.Sheets("Input")
    Set wsCalc = wb.Sheets("Energy Method")

    ' Clear previous calculation output (preserve header rows 1-21)
    wsCalc.Range("A22:Z90").ClearContents

    ' -------------------------------------------------------------------------
    ' Read inputs from Input sheet
    ' -------------------------------------------------------------------------

    ' Cross-section geometry
    Dim stations() As Double, elevations() As Double, manningsN() As Double
    Dim nPts As Long
    Call ReadCrossSection(wsInput, stations, elevations, manningsN, nPts)

    ' Bridge geometry
    Dim bridgeLeftSta As Double, bridgeRightSta As Double
    Dim lowChordLeft As Double, lowChordRight As Double
    Dim highChord As Double, skewAngle As Double
    Call ReadBridgeGeometry(wsInput, bridgeLeftSta, bridgeRightSta, _
                            lowChordLeft, lowChordRight, highChord, skewAngle)

    ' Pier data
    Dim pierStations() As Double, pierWidths() As Double, pierShapes() As String
    Dim nPiers As Long
    Call ReadPierData(wsInput, pierStations, pierWidths, pierShapes, nPiers)

    ' Flow profiles and reach lengths
    Dim profileNames() As String, profileQ() As Double, profileDSWSEL() As Double
    Dim profileSlope() As Double, profileContrLen() As Double, profileExpLen() As Double
    Dim nProfiles As Long
    Call ReadFlowProfiles(wsInput, profileNames, profileQ, profileDSWSEL, nProfiles)
    Call ReadReachLengths(wsInput, profileContrLen, profileExpLen, profileSlope, nProfiles)

    ' Energy coefficients
    Dim Cc As Double, Ce As Double
    Call ReadEnergyCoeffs(wsInput, Cc, Ce)

    ' Iteration settings
    Dim maxIter As Long, tolerance As Double, initGuessOffset As Double
    Call ReadIterationSettings(wsInput, maxIter, tolerance, initGuessOffset)

    ' Bank station indices (0-based) for conveyance subsection splits
    Dim leftBank As Long, rightBank As Long
    Call FindBankStations(wsInput, leftBank, rightBank)

    ' -------------------------------------------------------------------------
    ' Write header block (rows 1-5)
    ' -------------------------------------------------------------------------
    wsCalc.Range("A1").Value = "ENERGY METHOD (Standard Step)"
    wsCalc.Range("A2").Value = "Reference: HEC-RAS Hydraulic Reference Manual, Ch. 5"
    wsCalc.Range("A3").Value = "WS_us = WS_ds + h_f + Cc*|D(aV^2/2g)| + Ce*|D(aV^2/2g)|"
    wsCalc.Range("A1").Font.Bold = True
    wsCalc.Range("A1").Font.Size = 14

    ' -------------------------------------------------------------------------
    ' Input echo block (rows 7-11)
    ' -------------------------------------------------------------------------
    Dim echoRow As Long: echoRow = 7
    wsCalc.Cells(echoRow, 1).Value = "INPUT ECHO"
    wsCalc.Cells(echoRow, 1).Font.Bold = True
    wsCalc.Cells(echoRow + 1, 1).Value = "Cc:":              wsCalc.Cells(echoRow + 1, 2).Value = Cc
    wsCalc.Cells(echoRow + 2, 1).Value = "Ce:":              wsCalc.Cells(echoRow + 2, 2).Value = Ce
    wsCalc.Cells(echoRow + 3, 1).Value = "Max iterations:":  wsCalc.Cells(echoRow + 3, 2).Value = maxIter
    wsCalc.Cells(echoRow + 4, 1).Value = "Tolerance (ft):":  wsCalc.Cells(echoRow + 4, 2).Value = tolerance

    ' -------------------------------------------------------------------------
    ' Step-by-step calculations per profile (rows 22+)
    ' -------------------------------------------------------------------------
    Dim calcStartRow As Long: calcStartRow = 22
    wsCalc.Cells(calcStartRow, 1).Value = "Step"
    wsCalc.Cells(calcStartRow, 1).Font.Bold = True

    Dim p As Long
    For p = 0 To nProfiles - 1

        ' Column offset: profile 0 in col 2, profile 1 in col 4, etc.
        Dim col As Long
        col = 2 + p * 2
        wsCalc.Cells(calcStartRow, col).Value = profileNames(p)
        wsCalc.Cells(calcStartRow, col).Font.Bold = True

        ' Profile inputs
        Dim Q As Double, dsWSEL As Double
        Q = profileQ(p)
        dsWSEL = profileDSWSEL(p)

        Dim contrLen As Double, expLen As Double
        contrLen = profileContrLen(p)
        expLen = profileExpLen(p)

        Dim avgLowChord As Double
        avgLowChord = (lowChordLeft + lowChordRight) / 2#

        ' ---------------------------------------------------------------------
        ' Steps 1-4: Downstream section properties at DS WSEL
        ' ---------------------------------------------------------------------
        Dim dsArea As Double, dsVel As Double, dsVelHead As Double
        Dim dsConv As Double, dsSf As Double

        dsArea    = CalcFlowArea(stations, elevations, nPts, dsWSEL)
        dsVel     = CalcVelocity(Q, dsArea)
        dsVelHead = CalcVelocityHead(dsVel, 1#)
        dsConv    = CalcConveyance(stations, elevations, manningsN, nPts, dsWSEL, leftBank, rightBank)
        dsSf      = CalcFrictionSlope(Q, dsConv)

        Dim r As Long: r = calcStartRow + 1
        wsCalc.Cells(r, 1).Value = "1. DS area (sq ft):":    wsCalc.Cells(r, col).Value = Round(dsArea, 2):    r = r + 1
        wsCalc.Cells(r, 1).Value = "2. DS velocity (ft/s):": wsCalc.Cells(r, col).Value = Round(dsVel, 4):     r = r + 1
        wsCalc.Cells(r, 1).Value = "3. DS vel head (ft):":   wsCalc.Cells(r, col).Value = Round(dsVelHead, 4): r = r + 1
        wsCalc.Cells(r, 1).Value = "4. DS Sf:":              wsCalc.Cells(r, col).Value = Round(dsSf, 6):      r = r + 1

        ' ---------------------------------------------------------------------
        ' Steps 5-7: Bridge section properties
        ' Clip cross-section to bridge opening, subtract pier blockage
        ' ---------------------------------------------------------------------
        Dim clipSta() As Double, clipElev() As Double, clipN As Long
        Call ClipCrossSectionToRange(stations, elevations, nPts, _
                                      bridgeLeftSta, bridgeRightSta, _
                                      clipSta, clipElev, clipN)

        Dim bridgeArea As Double, bridgeVel As Double, bridgeVelHead As Double
        bridgeArea = CalcFlowArea(clipSta, clipElev, clipN, dsWSEL)

        Dim blockage As Double
        blockage = CalcPierBlockage(stations, elevations, nPts, _
                                    pierStations, pierWidths, nPiers, dsWSEL)
        If bridgeArea > blockage Then
            bridgeArea = bridgeArea - blockage
        End If

        bridgeVel     = CalcVelocity(Q, bridgeArea)
        bridgeVelHead = CalcVelocityHead(bridgeVel, 1#)

        wsCalc.Cells(r, 1).Value = "5. Bridge net area (sq ft)": wsCalc.Cells(r, col).Value = Round(bridgeArea, 2):    r = r + 1
        wsCalc.Cells(r, 1).Value = "6. Bridge velocity (ft/s):": wsCalc.Cells(r, col).Value = Round(bridgeVel, 4):     r = r + 1
        wsCalc.Cells(r, 1).Value = "7. Bridge vel head (ft):":   wsCalc.Cells(r, col).Value = Round(bridgeVelHead, 4): r = r + 1

        ' ---------------------------------------------------------------------
        ' Iterate for upstream WSEL
        ' Strategy: bisection first; switch to secant when |error| < 0.5
        '           after 3 iterations
        ' ---------------------------------------------------------------------
        Dim trialWSEL As Double
        trialWSEL = dsWSEL + initGuessOffset

        Dim iterLog As IterationLog
        iterLog.nEntries = 0

        Dim iter As Long
        Dim converged As Boolean: converged = False
        Dim usWSEL As Double, totalLoss As Double
        Dim prevTrial As Double, prevError As Double
        Dim useBisection As Boolean: useBisection = True
        Dim lowerBound As Double, upperBound As Double
        lowerBound = dsWSEL
        upperBound = dsWSEL + 10#

        ' Declare vars used inside loop at procedure scope (VBA requirement)
        Dim usArea As Double, usVel As Double, usVelHead As Double
        Dim usConv As Double, usSf As Double
        Dim avgSf As Double, hf As Double
        Dim hc As Double, he As Double
        Dim errVal As Double

        For iter = 1 To maxIter

            ' US section properties at trial WSEL
            usArea    = CalcFlowArea(stations, elevations, nPts, trialWSEL)
            usVel     = CalcVelocity(Q, usArea)
            usVelHead = CalcVelocityHead(usVel, 1#)
            usConv    = CalcConveyance(stations, elevations, manningsN, nPts, trialWSEL, leftBank, rightBank)
            usSf      = CalcFrictionSlope(Q, usConv)

            ' Friction loss: average of DS and US friction slopes * total reach length
            avgSf = CalcAvgFrictionSlope(dsSf, usSf)
            hf    = CalcFrictionLoss(avgSf, contrLen + expLen)

            ' Contraction loss (DS to bridge face)
            hc = Cc * Abs(bridgeVelHead - dsVelHead)

            ' Expansion loss (bridge face to US)
            he = Ce * Abs(usVelHead - bridgeVelHead)

            ' Energy balance
            totalLoss = hf + hc + he
            usWSEL    = dsWSEL + totalLoss

            ' Signed error: positive means trial is too high
            errVal = trialWSEL - usWSEL

            Call LogIteration(iterLog, trialWSEL, usWSEL, Abs(errVal))

            If IsConverged(trialWSEL, usWSEL, tolerance) Then
                converged = True
                Exit For
            End If

            ' Update trial: bisection first, then secant once close enough
            If Abs(errVal) < 0.5 And iter > 3 Then
                ' Secant method
                Dim newTrial As Double
                newTrial = SecantUpdate(prevTrial, prevError, trialWSEL, errVal)
                ' Keep within bounds
                If newTrial < lowerBound Then newTrial = lowerBound
                If newTrial > upperBound Then newTrial = upperBound
                prevTrial  = trialWSEL
                prevError  = errVal
                trialWSEL  = newTrial
            Else
                ' Bisection — update bracket
                If errVal > 0# Then
                    upperBound = trialWSEL
                Else
                    lowerBound = trialWSEL
                End If
                prevTrial  = trialWSEL
                prevError  = errVal
                trialWSEL  = BisectMidpoint(lowerBound, upperBound)
            End If

        Next iter

        ' ---------------------------------------------------------------------
        ' Steps 8-16: Post-iteration output
        ' ---------------------------------------------------------------------
        wsCalc.Cells(r, 1).Value = "8. Friction loss h_f (ft):":    wsCalc.Cells(r, col).Value = Round(hf, 4):        r = r + 1
        wsCalc.Cells(r, 1).Value = "9. Contraction loss h_c (ft):": wsCalc.Cells(r, col).Value = Round(hc, 4):        r = r + 1
        wsCalc.Cells(r, 1).Value = "10. Expansion loss h_e (ft):":  wsCalc.Cells(r, col).Value = Round(he, 4):        r = r + 1
        wsCalc.Cells(r, 1).Value = "11. Total loss (ft):":          wsCalc.Cells(r, col).Value = Round(totalLoss, 4): r = r + 1

        wsCalc.Cells(r, 1).Value = "12. US WSEL (ft):"
        wsCalc.Cells(r, col).Value = Round(usWSEL, 3)
        wsCalc.Cells(r, col).Font.Bold = True
        r = r + 1

        wsCalc.Cells(r, 1).Value = "13. Converged:"
        wsCalc.Cells(r, col).Value = IIf(converged, "YES (" & iter & " iters)", "NO — max iterations")
        If Not converged Then wsCalc.Cells(r, col).Font.Color = RGB(255, 0, 0)
        r = r + 1

        ' Step 14: Flow regime (based on US WSEL vs bridge chords)
        Dim regime As String
        regime = DetectFlowRegime(usWSEL, avgLowChord, highChord)
        wsCalc.Cells(r, 1).Value = "14. Flow regime:"
        wsCalc.Cells(r, col).Value = regime
        r = r + 1

        ' Steps 15-16: TUFLOW Form Loss Coefficients
        ' Pier fraction = blockage area / (net bridge area + blockage area)
        Dim pierFrac As Double
        If bridgeArea + blockage > 0# Then
            pierFrac = blockage / (bridgeArea + blockage)
        Else
            pierFrac = 0#
        End If

        Dim pierLoss As Double, superLoss As Double
        pierLoss  = totalLoss * pierFrac
        superLoss = totalLoss - pierLoss

        Dim flcPier As Double
        flcPier = CalcTuflowPierFLC(pierLoss, dsVel)
        wsCalc.Cells(r, 1).Value = "15. TUFLOW Pier FLC:"
        wsCalc.Cells(r, col).Value = Round(flcPier, 4)
        r = r + 1

        Dim flcSuper As Double
        wsCalc.Cells(r, 1).Value = "16. TUFLOW Super FLC:"
        If regime = "F" Then
            wsCalc.Cells(r, col).Value = "N/A"
            flcSuper = 0#
        Else
            flcSuper = CalcTuflowSuperFLC(superLoss, dsVel)
            wsCalc.Cells(r, col).Value = Round(flcSuper, 4)
        End If
        r = r + 1

        ' ---------------------------------------------------------------------
        ' Iteration log (rows 62+, one block of 6 columns per profile)
        ' ---------------------------------------------------------------------
        Call WriteIterationLog(wsCalc, 62, 1 + p * 6, iterLog)

        ' ---------------------------------------------------------------------
        ' Results block (rows 77-86)
        ' Row 77: "RESULTS" header / label column (written once on first profile)
        ' Row 78: Profile name
        ' Row 79: US WSEL
        ' Row 80: Head Loss
        ' Row 81: Approach Velocity
        ' Row 82: Bridge Velocity
        ' Row 83: DS Froude
        ' Row 84: Flow Regime
        ' Row 85: TUFLOW Pier FLC
        ' Row 86: TUFLOW Super FLC
        ' ---------------------------------------------------------------------
        Dim resRow As Long: resRow = 77

        If p = 0 Then
            wsCalc.Cells(resRow, 1).Value = "RESULTS"
            wsCalc.Cells(resRow, 1).Font.Bold = True
            wsCalc.Cells(resRow + 1, 1).Value = "Profile"
            wsCalc.Cells(resRow + 2, 1).Value = "US WSEL (ft)"
            wsCalc.Cells(resRow + 3, 1).Value = "Head Loss (ft)"
            wsCalc.Cells(resRow + 4, 1).Value = "Approach Velocity (ft/s)"
            wsCalc.Cells(resRow + 5, 1).Value = "Bridge Velocity (ft/s)"
            wsCalc.Cells(resRow + 6, 1).Value = "DS Froude"
            wsCalc.Cells(resRow + 7, 1).Value = "Flow Regime"
            wsCalc.Cells(resRow + 8, 1).Value = "TUFLOW Pier FLC"
            wsCalc.Cells(resRow + 9, 1).Value = "TUFLOW Super FLC"
        End If

        ' Data column: profile 0 in col 2, profile 1 in col 3, etc.
        Dim resCol As Long: resCol = 2 + p

        Dim dsTW As Double
        dsTW = CalcTopWidth(stations, elevations, nPts, dsWSEL)

        wsCalc.Cells(resRow + 1, resCol).Value = profileNames(p)
        wsCalc.Cells(resRow + 2, resCol).Value = Round(usWSEL, 3)
        wsCalc.Cells(resRow + 3, resCol).Value = Round(totalLoss, 3)
        wsCalc.Cells(resRow + 4, resCol).Value = Round(dsVel, 3)
        wsCalc.Cells(resRow + 5, resCol).Value = Round(bridgeVel, 3)
        wsCalc.Cells(resRow + 6, resCol).Value = Round(CalcFroude(dsVel, dsArea, dsTW), 4)
        wsCalc.Cells(resRow + 7, resCol).Value = regime
        wsCalc.Cells(resRow + 8, resCol).Value = Round(flcPier, 4)
        wsCalc.Cells(resRow + 9, resCol).Value = IIf(regime = "F", "N/A", Round(flcSuper, 4))

    Next p

End Sub
