Attribute VB_Name = "mod_Momentum"
Option Explicit

' =============================================================================
' mod_Momentum.bas
' Momentum Balance Method for Bridge Loss Calculator
'
' Reference: HEC-RAS Hydraulic Reference Manual, Chapter 5
' Momentum balance: Sum(F) = Delta(M)
'   Pressure forces + Weight - Friction - Drag = Momentum change
'
' All units: English (ft, lb, cfs, slugs)
' =============================================================================

Private Const GRAVITY As Double = 32.2    ' ft/s^2
Private Const GAMMA As Double = 62.4      ' lb/ft^3 (unit weight of water)
Private Const RHO As Double = 1.94        ' slugs/ft^3 (density of water)

' -----------------------------------------------------------------------------
' CalcMomentumFlux
'
' Computes momentum flux (lb) at a cross-section.
'   M = rho * Q * V
'
' Parameters:
'   Q        - discharge (cfs)
'   velocity - average cross-section velocity (ft/s)
' -----------------------------------------------------------------------------
Public Function CalcMomentumFlux(Q As Double, velocity As Double) As Double
    CalcMomentumFlux = RHO * Q * velocity
End Function

' -----------------------------------------------------------------------------
' CalcHydrostaticForce
'
' Computes the hydrostatic pressure force (lb) acting on a cross-section.
'   F = gamma * A * ybar
'
' Parameters:
'   area         - flow area (sq ft)
'   centroidDepth - depth of flow area centroid below water surface (ft)
' -----------------------------------------------------------------------------
Public Function CalcHydrostaticForce(area As Double, centroidDepth As Double) As Double
    CalcHydrostaticForce = GAMMA * area * centroidDepth
End Function

' -----------------------------------------------------------------------------
' CalcCentroidDepth
'
' Computes the depth of the flow area centroid below the water surface (ft),
' using numerical integration over all wetted cross-section segments.
'
' For each clipped segment with depths d1 and d2 below WSEL:
'   segArea = 0.5 * (d1 + d2) * width
'   segYbar = (d1^2 + d1*d2 + d2^2) / (3 * (d1 + d2))   [trapezoid centroid]
'
' Returns the area-weighted average: sum(segArea * segYbar) / totalArea.
' Returns 0 if the section is dry.
' -----------------------------------------------------------------------------
Public Function CalcCentroidDepth( _
    stations() As Double, _
    elevations() As Double, _
    nPts As Long, _
    wsel As Double) As Double

    Dim totalArea As Double
    Dim moment As Double
    totalArea = 0#
    moment = 0#

    Dim i As Long
    Dim cx1 As Double, cz1 As Double, cx2 As Double, cz2 As Double

    For i = 0 To nPts - 2
        If ClipSegmentToWSEL(stations(i), elevations(i), _
                             stations(i + 1), elevations(i + 1), _
                             wsel, cx1, cz1, cx2, cz2) Then

            Dim d1 As Double, d2 As Double
            d1 = wsel - cz1
            d2 = wsel - cz2
            If d1 < 0# Then d1 = 0#
            If d2 < 0# Then d2 = 0#

            Dim segWidth As Double
            segWidth = cx2 - cx1

            ' Trapezoidal segment area
            Dim segArea As Double
            segArea = 0.5# * (d1 + d2) * segWidth

            ' Centroid depth of trapezoid from water surface:
            '   ybar = (d1^2 + d1*d2 + d2^2) / (3*(d1+d2))
            Dim segYbar As Double
            If (d1 + d2) > 0# Then
                segYbar = (d1 * d1 + d1 * d2 + d2 * d2) / (3# * (d1 + d2))
            Else
                segYbar = 0#
            End If

            totalArea = totalArea + segArea
            moment = moment + segArea * segYbar
        End If
    Next i

    If totalArea > 0# Then
        CalcCentroidDepth = moment / totalArea
    Else
        CalcCentroidDepth = 0#
    End If
End Function

' -----------------------------------------------------------------------------
' CalcDragForce
'
' Computes the hydrodynamic drag force (lb) on a bluff body (e.g. pier).
'   F_drag = 0.5 * Cd * rho * A_projected * V^2
'
' Parameters:
'   Cd            - drag coefficient (dimensionless); ~2.0 for bluff body piers
'   projectedArea - projected frontal area normal to flow (sq ft)
'   velocity      - approach velocity (ft/s)
' -----------------------------------------------------------------------------
Public Function CalcDragForce(Cd As Double, projectedArea As Double, _
                               velocity As Double) As Double
    CalcDragForce = 0.5# * Cd * RHO * projectedArea * velocity * velocity
End Function

' -----------------------------------------------------------------------------
' RunMomentum
'
' Main entry point for the Momentum Method.
' Reads inputs from the "Input" sheet, iterates for the upstream WSEL using
' a momentum balance, and writes step-by-step results to "Momentum Method".
'
' For each flow profile:
'   1. DS section properties (area, velocity, centroid, hydrostatic force,
'      momentum flux)
'   2. Pier drag (Cd = 2.0, projected area = pier blockage at DS WSEL)
'   3. Iterate for US WSEL via momentum balance:
'        F_us = F_ds - Weight + Friction + Drag + M_ds - M_us
'      Residual converted to WSEL correction with 0.5 damping factor.
'      Switches from bisection to secant once within 0.5 ft.
'   4. Write 15 labeled calculation steps per profile.
'   5. Write iteration log starting at row 62.
'   6. Write results block at rows 77-86.
'
' Results block rows (resRow = 77):
'   Row 77: "RESULTS" label
'   Row 78: Profile name        (+1)
'   Row 79: US WSEL (ft)        (+2)
'   Row 80: Head Loss (ft)      (+3)
'   Row 81: DS Velocity (ft/s)  (+4)
'   Row 82: DS Froude           (+5)
'   Row 83: (blank skip row)    (+6)
'   Row 84: Flow Regime         (+7)
'   Row 85: TUFLOW Pier FLC     (+8)
'   Row 86: TUFLOW Super FLC    (+9)
' -----------------------------------------------------------------------------
Public Sub RunMomentum(wb As Object)

    Dim wsInput As Object, wsCalc As Object
    Set wsInput = wb.Sheets("Input")
    Set wsCalc = wb.Sheets("Momentum Method")

    ' Clear previous calculation output (keep header rows 1-5)
    wsCalc.Range("A22:Z90").ClearContents

    ' -----------------------------------------------------------------------
    ' Read inputs via mod_Utilities helper subs
    ' -----------------------------------------------------------------------
    Dim stations() As Double, elevations() As Double, manningsN() As Double
    Dim nPts As Long
    Call ReadCrossSection(wsInput, stations, elevations, manningsN, nPts)

    Dim bridgeLeftSta As Double, bridgeRightSta As Double
    Dim lowChordLeft As Double, lowChordRight As Double
    Dim highChord As Double, skewAngle As Double
    Call ReadBridgeGeometry(wsInput, bridgeLeftSta, bridgeRightSta, _
                            lowChordLeft, lowChordRight, highChord, skewAngle)

    Dim pierStations() As Double, pierWidths() As Double, pierShapes() As String
    Dim nPiers As Long
    Call ReadPierData(wsInput, pierStations, pierWidths, pierShapes, nPiers)

    Dim profileNames() As String, profileQ() As Double, profileDSWSEL() As Double
    Dim profileSlope() As Double, profileContrLen() As Double, profileExpLen() As Double
    Dim nProfiles As Long
    Call ReadFlowProfiles(wsInput, profileNames, profileQ, profileDSWSEL, nProfiles)
    Call ReadReachLengths(wsInput, profileContrLen, profileExpLen, profileSlope, nProfiles)

    Dim maxIter As Long, tolerance As Double, initGuessOffset As Double
    Call ReadIterationSettings(wsInput, maxIter, tolerance, initGuessOffset)

    Dim leftBank As Long, rightBank As Long
    Call FindBankStations(wsInput, leftBank, rightBank)

    ' -----------------------------------------------------------------------
    ' Write header block (rows 1-5)
    ' -----------------------------------------------------------------------
    wsCalc.Range("A1").Value = "MOMENTUM METHOD"
    wsCalc.Range("A1").Font.Bold = True
    wsCalc.Range("A1").Font.Size = 14
    wsCalc.Range("A2").Value = "Reference: HEC-RAS Hydraulic Reference Manual, Ch. 5"
    wsCalc.Range("A3").Value = "Sum(F) = Delta(M):  Pressure + Weight - Friction - Drag = Momentum change"
    wsCalc.Range("A4").Value = "F = gamma * A * ybar     M = rho * Q * V     F_drag = 0.5 * Cd * rho * A_pier * V^2"

    ' Input echo (rows 7-20)
    Dim echoRow As Long
    echoRow = 7
    wsCalc.Cells(echoRow, 1).Value = "INPUT ECHO"
    wsCalc.Cells(echoRow, 1).Font.Bold = True
    wsCalc.Cells(echoRow + 1, 1).Value = "Number of cross-section points:"
    wsCalc.Cells(echoRow + 1, 2).Value = nPts
    wsCalc.Cells(echoRow + 2, 1).Value = "Number of piers:"
    wsCalc.Cells(echoRow + 2, 2).Value = nPiers
    wsCalc.Cells(echoRow + 3, 1).Value = "Number of profiles:"
    wsCalc.Cells(echoRow + 3, 2).Value = nProfiles
    wsCalc.Cells(echoRow + 4, 1).Value = "Max iterations:"
    wsCalc.Cells(echoRow + 4, 2).Value = maxIter
    wsCalc.Cells(echoRow + 5, 1).Value = "Convergence tolerance (ft):"
    wsCalc.Cells(echoRow + 5, 2).Value = tolerance
    wsCalc.Cells(echoRow + 6, 1).Value = "Left bank index:"
    wsCalc.Cells(echoRow + 6, 2).Value = leftBank
    wsCalc.Cells(echoRow + 7, 1).Value = "Right bank index:"
    wsCalc.Cells(echoRow + 7, 2).Value = rightBank
    wsCalc.Cells(echoRow + 8, 1).Value = "Bridge left station (ft):"
    wsCalc.Cells(echoRow + 8, 2).Value = bridgeLeftSta
    wsCalc.Cells(echoRow + 9, 1).Value = "Bridge right station (ft):"
    wsCalc.Cells(echoRow + 9, 2).Value = bridgeRightSta
    wsCalc.Cells(echoRow + 10, 1).Value = "Low chord left (ft):"
    wsCalc.Cells(echoRow + 10, 2).Value = lowChordLeft
    wsCalc.Cells(echoRow + 11, 1).Value = "Low chord right (ft):"
    wsCalc.Cells(echoRow + 11, 2).Value = lowChordRight
    wsCalc.Cells(echoRow + 12, 1).Value = "High chord (ft):"
    wsCalc.Cells(echoRow + 12, 2).Value = highChord

    ' -----------------------------------------------------------------------
    ' Calculation header row (row 22)
    ' -----------------------------------------------------------------------
    Dim calcStartRow As Long
    calcStartRow = 22
    wsCalc.Cells(calcStartRow, 1).Value = "Step"
    wsCalc.Cells(calcStartRow, 1).Font.Bold = True

    ' -----------------------------------------------------------------------
    ' Per-profile calculations
    ' -----------------------------------------------------------------------
    Dim p As Long
    For p = 0 To nProfiles - 1

        Dim col As Long
        col = 2 + p * 2   ' Profile columns: 2, 4, 6, ...

        wsCalc.Cells(calcStartRow, col).Value = profileNames(p)
        wsCalc.Cells(calcStartRow, col).Font.Bold = True

        ' --- Input values for this profile ---
        Dim Q As Double, dsWSEL As Double
        Q = profileQ(p)
        dsWSEL = profileDSWSEL(p)

        Dim slope As Double, reachLen As Double
        slope = profileSlope(p)
        reachLen = profileContrLen(p) + profileExpLen(p)

        Dim avgLowChord As Double
        avgLowChord = (lowChordLeft + lowChordRight) / 2#

        ' ------------------------------------------------------------------
        ' Step 1: DS area
        ' ------------------------------------------------------------------
        Dim dsArea As Double
        dsArea = CalcFlowArea(stations, elevations, nPts, dsWSEL)

        ' ------------------------------------------------------------------
        ' Step 2: DS velocity
        ' ------------------------------------------------------------------
        Dim dsVel As Double
        dsVel = CalcVelocity(Q, dsArea)

        ' ------------------------------------------------------------------
        ' Step 3: DS centroid depth and hydrostatic force
        ' ------------------------------------------------------------------
        Dim dsCentroid As Double
        dsCentroid = CalcCentroidDepth(stations, elevations, nPts, dsWSEL)

        Dim dsHydroF As Double
        dsHydroF = CalcHydrostaticForce(dsArea, dsCentroid)

        ' ------------------------------------------------------------------
        ' Step 4: DS momentum flux
        ' ------------------------------------------------------------------
        Dim dsMomFlux As Double
        dsMomFlux = CalcMomentumFlux(Q, dsVel)

        ' ------------------------------------------------------------------
        ' Step 5: Pier drag force (Cd = 2.0 for bluff body piers)
        ' ------------------------------------------------------------------
        Dim pierBlockage As Double
        If nPiers > 0 Then
            pierBlockage = CalcPierBlockage(stations, elevations, nPts, _
                                            pierStations, pierWidths, nPiers, dsWSEL)
        Else
            pierBlockage = 0#
        End If
        Dim pierDrag As Double
        pierDrag = CalcDragForce(2#, pierBlockage, dsVel)

        ' --- Write steps 1-5 ---
        Dim r As Long
        r = calcStartRow + 1
        wsCalc.Cells(r, 1).Value = "1. DS area (sq ft):"
        wsCalc.Cells(r, col).Value = Round(dsArea, 2)
        r = r + 1

        wsCalc.Cells(r, 1).Value = "2. DS velocity (ft/s):"
        wsCalc.Cells(r, col).Value = Round(dsVel, 4)
        r = r + 1

        wsCalc.Cells(r, 1).Value = "3. DS centroid depth (ft):"
        wsCalc.Cells(r, col).Value = Round(dsCentroid, 4)
        r = r + 1

        wsCalc.Cells(r, 1).Value = "4. DS hydrostatic force (lb):"
        wsCalc.Cells(r, col).Value = Round(dsHydroF, 0)
        r = r + 1

        wsCalc.Cells(r, 1).Value = "5. DS momentum flux (lb):"
        wsCalc.Cells(r, col).Value = Round(dsMomFlux, 0)
        r = r + 1

        wsCalc.Cells(r, 1).Value = "5a. Pier blockage area (sq ft):"
        wsCalc.Cells(r, col).Value = Round(pierBlockage, 2)
        r = r + 1

        wsCalc.Cells(r, 1).Value = "5b. Pier drag force (lb):"
        wsCalc.Cells(r, col).Value = Round(pierDrag, 0)
        r = r + 1

        ' ------------------------------------------------------------------
        ' Steps 6-12: Iterate for US WSEL
        ' ------------------------------------------------------------------
        Dim trialWSEL As Double
        trialWSEL = dsWSEL + initGuessOffset

        Dim iterLog As IterationLog
        iterLog.nEntries = 0

        Dim iter As Long
        Dim converged As Boolean
        converged = False

        Dim usWSEL As Double
        usWSEL = trialWSEL

        Dim prevTrial As Double, prevError As Double
        prevTrial = 0#
        prevError = 0#

        Dim lowerBound As Double, upperBound As Double
        lowerBound = dsWSEL
        upperBound = dsWSEL + 10#

        ' Variables declared outside loop so they hold last iteration values
        Dim usArea As Double, usVel As Double, usCentroid As Double
        Dim usHydroF As Double, usMomFlux As Double
        Dim avgArea As Double, weightF As Double
        Dim dsConv As Double, usConv As Double
        Dim dsSf As Double, usSf As Double, avgSf As Double
        Dim frictionF As Double
        Dim targetHydroF As Double
        Dim residual As Double
        Dim usTW As Double, wselError As Double

        ' Pre-compute DS conveyance once (does not change per iteration)
        dsConv = CalcConveyance(stations, elevations, manningsN, nPts, dsWSEL, leftBank, rightBank)
        dsSf = CalcFrictionSlope(Q, dsConv)

        For iter = 1 To maxIter

            ' US section properties at trial WSEL
            usArea = CalcFlowArea(stations, elevations, nPts, trialWSEL)
            usVel = CalcVelocity(Q, usArea)
            usCentroid = CalcCentroidDepth(stations, elevations, nPts, trialWSEL)

            usHydroF = CalcHydrostaticForce(usArea, usCentroid)
            usMomFlux = CalcMomentumFlux(Q, usVel)

            ' Weight component along channel slope
            avgArea = (dsArea + usArea) / 2#
            weightF = GAMMA * avgArea * reachLen * slope

            ' Friction force: gamma * A_avg * Sf_avg * L
            usConv = CalcConveyance(stations, elevations, manningsN, nPts, trialWSEL, leftBank, rightBank)
            usSf = CalcFrictionSlope(Q, usConv)
            avgSf = CalcAvgFrictionSlope(dsSf, usSf)
            frictionF = GAMMA * avgArea * avgSf * reachLen

            ' Momentum balance rearranged to solve for target US hydrostatic force:
            '   F_us + M_us = F_ds + M_ds - Weight + Friction + Drag
            '   => target F_us = F_ds - Weight + Friction + Drag + M_ds - M_us
            targetHydroF = dsHydroF - weightF + frictionF + pierDrag + dsMomFlux - usMomFlux

            ' Residual: how far off is the current US hydrostatic force
            residual = usHydroF - targetHydroF

            ' Convert residual to approximate WSEL correction
            ' dF/dy ~ gamma * T * usCentroid (sensitivity of hydrostatic force to WSEL)
            usTW = CalcTopWidth(stations, elevations, nPts, trialWSEL)
            If usTW > 0# Then
                wselError = residual / (GAMMA * usTW * (usCentroid + 0.001#))
            Else
                wselError = residual * 0.001#
            End If

            ' Damped correction (0.5 factor to improve stability)
            usWSEL = trialWSEL - wselError * 0.5#

            Dim errVal As Double
            errVal = trialWSEL - usWSEL

            Call LogIteration(iterLog, trialWSEL, usWSEL, Abs(errVal))

            If IsConverged(trialWSEL, usWSEL, tolerance) Then
                converged = True
                usWSEL = trialWSEL
                Exit For
            End If

            ' Update trial WSEL: use secant if close, bisection otherwise
            If Abs(errVal) < 0.5# And iter > 3 Then
                ' Secant acceleration
                Dim newTrial As Double
                newTrial = SecantUpdate(prevTrial, prevError, trialWSEL, errVal)
                If newTrial < lowerBound Then newTrial = lowerBound
                If newTrial > upperBound Then newTrial = upperBound
                prevTrial = trialWSEL
                prevError = errVal
                trialWSEL = newTrial
            Else
                ' Bisection fallback — bracket update
                If errVal > 0# Then
                    upperBound = trialWSEL
                Else
                    lowerBound = trialWSEL
                End If
                prevTrial = trialWSEL
                prevError = errVal
                trialWSEL = BisectMidpoint(lowerBound, upperBound)
            End If

        Next iter

        Dim totalLoss As Double
        totalLoss = usWSEL - dsWSEL

        ' --- Write steps 6-15 ---
        wsCalc.Cells(r, 1).Value = "6. US area (sq ft):"
        wsCalc.Cells(r, col).Value = Round(usArea, 2)
        r = r + 1

        wsCalc.Cells(r, 1).Value = "7. US centroid depth (ft):"
        wsCalc.Cells(r, col).Value = Round(usCentroid, 4)
        r = r + 1

        wsCalc.Cells(r, 1).Value = "8. US hydrostatic force (lb):"
        wsCalc.Cells(r, col).Value = Round(usHydroF, 0)
        r = r + 1

        wsCalc.Cells(r, 1).Value = "9. US momentum flux (lb):"
        wsCalc.Cells(r, col).Value = Round(usMomFlux, 0)
        r = r + 1

        wsCalc.Cells(r, 1).Value = "10. Weight component (lb):"
        wsCalc.Cells(r, col).Value = Round(weightF, 0)
        r = r + 1

        wsCalc.Cells(r, 1).Value = "11. Friction force (lb):"
        wsCalc.Cells(r, col).Value = Round(frictionF, 0)
        r = r + 1

        wsCalc.Cells(r, 1).Value = "12. Total head loss (ft):"
        wsCalc.Cells(r, col).Value = Round(totalLoss, 4)
        r = r + 1

        wsCalc.Cells(r, 1).Value = "13. US WSEL (ft):"
        wsCalc.Cells(r, col).Value = Round(usWSEL, 3)
        wsCalc.Cells(r, col).Font.Bold = True
        r = r + 1

        wsCalc.Cells(r, 1).Value = "14. Converged:"
        wsCalc.Cells(r, col).Value = IIf(converged, "YES (" & iter & " iters)", "NO (" & maxIter & " iters)")
        r = r + 1

        ' Flow regime
        Dim regime As String
        regime = DetectFlowRegime(usWSEL, avgLowChord, highChord)
        wsCalc.Cells(r, 1).Value = "15. Flow regime:"
        wsCalc.Cells(r, col).Value = regime
        r = r + 1

        ' TUFLOW FLC outputs
        Dim pierFrac As Double
        If dsArea > 0# Then
            pierFrac = pierBlockage / dsArea
        Else
            pierFrac = 0#
        End If
        Dim pierLoss As Double
        pierLoss = totalLoss * pierFrac

        Dim flcPier As Double
        flcPier = CalcTuflowPierFLC(pierLoss, dsVel)

        wsCalc.Cells(r, 1).Value = "  TUFLOW Pier FLC:"
        wsCalc.Cells(r, col).Value = Round(flcPier, 4)
        r = r + 1

        If regime = "F" Then
            wsCalc.Cells(r, 1).Value = "  TUFLOW Super FLC:"
            wsCalc.Cells(r, col).Value = "N/A"
        Else
            Dim superLoss As Double
            superLoss = totalLoss - pierLoss
            wsCalc.Cells(r, 1).Value = "  TUFLOW Super FLC:"
            wsCalc.Cells(r, col).Value = Round(CalcTuflowSuperFLC(superLoss, dsVel), 4)
        End If

        ' ------------------------------------------------------------------
        ' Write iteration log (starting at row 62, offset by profile)
        ' ------------------------------------------------------------------
        Call WriteIterationLog(wsCalc, 62, 1 + p * 6, iterLog)

        ' ------------------------------------------------------------------
        ' Results block (rows 77-86)
        ' resRow=77: "RESULTS" label
        ' resRow+1=78: Profile
        ' resRow+2=79: US WSEL
        ' resRow+3=80: Head Loss
        ' resRow+4=81: DS Velocity
        ' resRow+5=82: DS Froude
        ' resRow+6=83: (blank skip row)
        ' resRow+7=84: Flow Regime
        ' resRow+8=85: TUFLOW Pier FLC
        ' resRow+9=86: TUFLOW Super FLC
        ' ------------------------------------------------------------------
        Dim resRow As Long
        resRow = 77

        If p = 0 Then
            ' Write row labels once (first profile only)
            wsCalc.Cells(resRow, 1).Value = "RESULTS"
            wsCalc.Cells(resRow, 1).Font.Bold = True
            wsCalc.Cells(resRow + 1, 1).Value = "Profile"
            wsCalc.Cells(resRow + 2, 1).Value = "US WSEL (ft)"
            wsCalc.Cells(resRow + 3, 1).Value = "Head Loss (ft)"
            wsCalc.Cells(resRow + 4, 1).Value = "DS Velocity (ft/s)"
            wsCalc.Cells(resRow + 5, 1).Value = "DS Froude"
            wsCalc.Cells(resRow + 6, 1).Value = ""              ' blank skip row
            wsCalc.Cells(resRow + 7, 1).Value = "Flow Regime"
            wsCalc.Cells(resRow + 8, 1).Value = "TUFLOW Pier FLC"
            wsCalc.Cells(resRow + 9, 1).Value = "TUFLOW Super FLC"
        End If

        Dim resCol As Long
        resCol = 2 + p

        Dim dsTW As Double
        dsTW = CalcTopWidth(stations, elevations, nPts, dsWSEL)

        wsCalc.Cells(resRow + 1, resCol).Value = profileNames(p)
        wsCalc.Cells(resRow + 2, resCol).Value = Round(usWSEL, 3)
        wsCalc.Cells(resRow + 3, resCol).Value = Round(totalLoss, 3)
        wsCalc.Cells(resRow + 4, resCol).Value = Round(dsVel, 3)
        wsCalc.Cells(resRow + 5, resCol).Value = Round(CalcFroude(dsVel, dsArea, dsTW), 4)
        wsCalc.Cells(resRow + 6, resCol).Value = ""             ' blank skip row
        wsCalc.Cells(resRow + 7, resCol).Value = regime
        wsCalc.Cells(resRow + 8, resCol).Value = Round(flcPier, 4)

        If regime = "F" Then
            wsCalc.Cells(resRow + 9, resCol).Value = "N/A"
        Else
            wsCalc.Cells(resRow + 9, resCol).Value = _
                Round(CalcTuflowSuperFLC(totalLoss - pierLoss, dsVel), 4)
        End If

    Next p

End Sub
