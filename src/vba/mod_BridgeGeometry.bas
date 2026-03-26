Attribute VB_Name = "mod_BridgeGeometry"
Option Explicit

' =============================================================================
' mod_BridgeGeometry.bas
' Bridge opening hydraulic geometry for Bridge Loss Calculator
'
' Computes effective flow area through a bridge opening, accounting for:
'   - Abutment stations (clip cross-section to bridge span)
'   - Variable low chord (pressure flow cap on effective WSEL)
'   - Pier blockage (solid area occupied by piers)
'   - Skew angle (cosine correction for oblique crossings)
'
' Calls CalcFlowArea and ClipSegmentToWSEL from mod_Geometry (same project).
' =============================================================================

' -----------------------------------------------------------------------------
' InterpolateElevation
'
' Linearly interpolates the ground elevation at targetSta from the paired
' stations()/elevations() arrays (0-based, nPts points).
'
' If targetSta is outside the array range the function clamps to the nearest
' endpoint elevation rather than extrapolating.
' -----------------------------------------------------------------------------
Public Function InterpolateElevation( _
    stations() As Double, _
    elevations() As Double, _
    nPts As Long, _
    targetSta As Double) As Double

    ' Clamp to left endpoint
    If targetSta <= stations(0) Then
        InterpolateElevation = elevations(0)
        Exit Function
    End If

    ' Clamp to right endpoint
    If targetSta >= stations(nPts - 1) Then
        InterpolateElevation = elevations(nPts - 1)
        Exit Function
    End If

    ' Find the bracketing segment
    Dim i As Long
    For i = 0 To nPts - 2
        If targetSta >= stations(i) And targetSta <= stations(i + 1) Then
            Dim dx As Double
            dx = stations(i + 1) - stations(i)
            If dx = 0# Then
                ' Coincident stations — return left point elevation
                InterpolateElevation = elevations(i)
            Else
                Dim t As Double
                t = (targetSta - stations(i)) / dx
                InterpolateElevation = elevations(i) + t * (elevations(i + 1) - elevations(i))
            End If
            Exit Function
        End If
    Next i

    ' Should never reach here given the clamp checks above, but be safe
    InterpolateElevation = elevations(nPts - 1)
End Function

' -----------------------------------------------------------------------------
' ClipCrossSectionToRange
'
' Extracts the portion of the cross-section between leftSta and rightSta.
'
' Algorithm:
'   1. Walk each segment of the input cross-section.
'   2. If a segment is entirely to the left of leftSta or entirely to the
'      right of rightSta, skip it.
'   3. At the left boundary: add an interpolated point at leftSta.
'   4. Add all interior points that fall strictly within [leftSta, rightSta].
'   5. At the right boundary: add an interpolated point at rightSta.
'
' Output arrays (outSta, outElev) are ReDim'd by this routine and filled with
' outN points (0-based).
'
' Preconditions:
'   - stations() is monotonically increasing.
'   - leftSta < rightSta.
'   - leftSta and rightSta lie within or beyond the cross-section range.
' -----------------------------------------------------------------------------
Public Sub ClipCrossSectionToRange( _
    stations() As Double, _
    elevations() As Double, _
    nPts As Long, _
    leftSta As Double, _
    rightSta As Double, _
    ByRef outSta() As Double, _
    ByRef outElev() As Double, _
    ByRef outN As Long)

    ' Worst-case output size: original nPts plus the two boundary points
    Dim maxOut As Long
    maxOut = nPts + 2
    ReDim outSta(0 To maxOut - 1)
    ReDim outElev(0 To maxOut - 1)
    outN = 0

    ' --- Add the left boundary point (interpolated at leftSta) ---
    Dim leftElev As Double
    leftElev = InterpolateElevation(stations, elevations, nPts, leftSta)
    outSta(outN) = leftSta
    outElev(outN) = leftElev
    outN = outN + 1

    ' --- Add all original points that fall strictly inside (leftSta, rightSta) ---
    Dim i As Long
    For i = 0 To nPts - 1
        If stations(i) > leftSta And stations(i) < rightSta Then
            outSta(outN) = stations(i)
            outElev(outN) = elevations(i)
            outN = outN + 1
        End If
    Next i

    ' --- Add the right boundary point (interpolated at rightSta) ---
    Dim rightElev As Double
    rightElev = InterpolateElevation(stations, elevations, nPts, rightSta)
    outSta(outN) = rightSta
    outElev(outN) = rightElev
    outN = outN + 1

    ' Trim to actual size
    ReDim Preserve outSta(0 To outN - 1)
    ReDim Preserve outElev(0 To outN - 1)
End Sub

' -----------------------------------------------------------------------------
' CalcBridgeOpeningArea
'
' Computes the gross flow area through the bridge opening (sq ft).
'
' Steps:
'   1. Clip the cross-section to [bridgeLeftSta, bridgeRightSta].
'   2. Determine the effective WSEL:
'        - The low chord varies linearly from lowChordLeft (at bridgeLeftSta)
'          to lowChordRight (at bridgeRightSta).
'        - The average low chord = (lowChordLeft + lowChordRight) / 2.
'        - For pressure flow the water is constrained below the low chord, so
'          the effective WSEL is capped at the average low chord:
'            effectiveWSEL = Min(wsel, avgLowChord)
'   3. Compute flow area of the clipped section at effectiveWSEL.
'   4. Apply skew correction: area * Cos(skewAngle) where skewAngle is in radians.
'
' Returns 0 if the section is dry or degenerate.
' -----------------------------------------------------------------------------
Public Function CalcBridgeOpeningArea( _
    stations() As Double, _
    elevations() As Double, _
    nPts As Long, _
    bridgeLeftSta As Double, _
    bridgeRightSta As Double, _
    lowChordLeft As Double, _
    lowChordRight As Double, _
    wsel As Double, _
    skewAngle As Double) As Double

    ' --- Step 1: Clip cross-section to bridge abutment stations ---
    Dim clipSta() As Double
    Dim clipElev() As Double
    Dim clipN As Long

    ClipCrossSectionToRange stations, elevations, nPts, _
                             bridgeLeftSta, bridgeRightSta, _
                             clipSta, clipElev, clipN

    If clipN < 2 Then
        CalcBridgeOpeningArea = 0#
        Exit Function
    End If

    ' --- Step 2: Cap effective WSEL at average low chord ---
    Dim avgLowChord As Double
    avgLowChord = (lowChordLeft + lowChordRight) / 2#

    Dim effectiveWSEL As Double
    If wsel < avgLowChord Then
        effectiveWSEL = wsel
    Else
        effectiveWSEL = avgLowChord
    End If

    ' --- Step 3: Gross flow area of the clipped section ---
    Dim grossArea As Double
    grossArea = CalcFlowArea(clipSta, clipElev, clipN, effectiveWSEL)

    ' --- Step 4: Skew correction ---
    CalcBridgeOpeningArea = grossArea * Cos(skewAngle)
End Function

' -----------------------------------------------------------------------------
' CalcPierBlockage
'
' Computes the total area blocked by piers (sq ft).
'
' For each pier j (0-based, nPiers total):
'   blockage_j = pierWidths(j) * Max(0, wsel - bedElev_at_pierStation)
'
' where bedElev_at_pierStation is obtained from InterpolateElevation.
'
' Skew is NOT applied here — CalcNetBridgeArea applies skew to the net result
' consistently.  (Pier blockage is also a projected area in the normal-to-flow
' plane and needs the same cos(skew) factor, applied once in CalcNetBridgeArea.)
' -----------------------------------------------------------------------------
Public Function CalcPierBlockage( _
    stations() As Double, _
    elevations() As Double, _
    nPts As Long, _
    pierStations() As Double, _
    pierWidths() As Double, _
    nPiers As Long, _
    wsel As Double) As Double

    Dim totalBlockage As Double
    totalBlockage = 0#

    Dim j As Long
    For j = 0 To nPiers - 1
        Dim bedElev As Double
        bedElev = InterpolateElevation(stations, elevations, nPts, pierStations(j))

        Dim depth As Double
        depth = wsel - bedElev
        If depth < 0# Then depth = 0#

        totalBlockage = totalBlockage + pierWidths(j) * depth
    Next j

    CalcPierBlockage = totalBlockage
End Function

' -----------------------------------------------------------------------------
' CalcNetBridgeArea
'
' Net bridge opening area (sq ft) = gross opening area - pier blockage,
' both projected to the normal-to-flow plane via the skew correction.
'
' Implementation:
'   grossArea  = CalcBridgeOpeningArea(...) — already skew-corrected
'   pierBlock  = CalcPierBlockage(...)       — raw (no skew yet)
'   netArea    = grossArea - pierBlock * Cos(skewAngle)
'
' If netArea < 0 (pathological pier data) the function returns 0.
' -----------------------------------------------------------------------------
Public Function CalcNetBridgeArea( _
    stations() As Double, _
    elevations() As Double, _
    nPts As Long, _
    bridgeLeftSta As Double, _
    bridgeRightSta As Double, _
    lowChordLeft As Double, _
    lowChordRight As Double, _
    pierStations() As Double, _
    pierWidths() As Double, _
    nPiers As Long, _
    wsel As Double, _
    skewAngle As Double) As Double

    ' Gross opening area (already includes skew via CalcBridgeOpeningArea)
    Dim grossArea As Double
    grossArea = CalcBridgeOpeningArea( _
        stations, elevations, nPts, _
        bridgeLeftSta, bridgeRightSta, _
        lowChordLeft, lowChordRight, _
        wsel, skewAngle)

    ' Pier blockage (raw, skew applied below for consistency)
    Dim pierBlock As Double
    If nPiers > 0 Then
        pierBlock = CalcPierBlockage( _
            stations, elevations, nPts, _
            pierStations, pierWidths, nPiers, _
            wsel) * Cos(skewAngle)
    Else
        pierBlock = 0#
    End If

    Dim netArea As Double
    netArea = grossArea - pierBlock
    If netArea < 0# Then netArea = 0#

    CalcNetBridgeArea = netArea
End Function
